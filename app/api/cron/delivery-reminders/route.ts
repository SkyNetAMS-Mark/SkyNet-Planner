import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Vercel Cron jobs call this endpoint via GET
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (in production)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return sendAllReminders()
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return sendAllReminders()
}

async function sendAllReminders() {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = await createClient()

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Find all parcels for today that need reminders
    const { data: parcels, error: queryError } = await supabase
      .from('parcels')
      .select(`
        *,
        senders (company_name),
        region_schedules!selected_slot_id (
          delivery_periods (start_time, end_time)
        )
      `)
      .eq('delivery_date', today)
      .is('delivery_reminder_sent_at', null)
      .not('selected_slot_id', 'is', null)
      .in('status', ['slot_selected', 'in_transit'])

    if (queryError) {
      return NextResponse.json(
        { error: 'Query error: ' + queryError.message },
        { status: 500 }
      )
    }

    const results = {
      total: parcels?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    if (!parcels || parcels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No parcels need delivery reminders today',
        results
      })
    }

    // Read email template
    const templatePath = join(process.cwd(), 'public', 'email-delivery-day-template.html')
    const emailTemplate = readFileSync(templatePath, 'utf-8')

    // Process each parcel
    for (const parcel of parcels) {
      try {
        // Get time window
        const startTime = parcel.region_schedules?.delivery_periods?.start_time?.slice(0, 5) || '??:??'
        const endTime = parcel.region_schedules?.delivery_periods?.end_time?.slice(0, 5) || '??:??'
        const timeWindow = `${startTime} - ${endTime}`

        // Replace placeholders
        const emailHtml = emailTemplate
          .replace(/{{RECEIVER_NAME}}/g, parcel.receiver_name)
          .replace(/{{TIME_WINDOW}}/g, timeWindow)
          .replace(/{{TRACKING_NUMBER}}/g, parcel.tracking_number)
          .replace(/{{SENDER_COMPANY}}/g, parcel.senders?.company_name || 'Afzender')
          .replace(/{{RECEIVER_ADDRESS}}/g, parcel.receiver_address)
          .replace(/{{POSTAL_CODE}}/g, parcel.receiver_postal_code.toString())

        // Send email
        const { error } = await resend.emails.send({
          from: 'SkyNet Belgium <onboarding@resend.dev>',
          to: parcel.receiver_email,
          subject: 'SkyNet bezorgt vandaag uw pakket!',
          html: emailHtml,
        })

        if (error) {
          results.failed++
          results.errors.push(`${parcel.tracking_number}: ${error.message}`)
          continue
        }

        // Update parcel
        await supabase
          .from('parcels')
          .update({ delivery_reminder_sent_at: new Date().toISOString() })
          .eq('id', parcel.id)

        results.sent++
      } catch (err: any) {
        results.failed++
        results.errors.push(`${parcel.tracking_number}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} parcels: ${results.sent} sent, ${results.failed} failed`,
      results
    })

  } catch (error: any) {
    console.error('Cron delivery reminders error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    )
  }
}
