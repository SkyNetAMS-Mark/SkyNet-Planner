import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const body = await request.json().catch(() => ({}))
    const { parcelId, sendAll } = body

    const supabase = await createClient()

    // If parcelId provided, send reminder for single parcel
    if (parcelId) {
      return await sendSingleReminder(supabase, resend, parcelId)
    }

    // If sendAll is true, send reminders for all today's deliveries
    if (sendAll) {
      return await sendAllReminders(supabase, resend)
    }

    return NextResponse.json(
      { error: 'Either parcelId or sendAll: true is required' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Send delivery reminder error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    )
  }
}

async function sendSingleReminder(supabase: any, resend: Resend, parcelId: string) {
  // Fetch parcel with slot details
  const { data: parcel, error: parcelError } = await supabase
    .from('parcels')
    .select(`
      *,
      senders (company_name),
      region_schedules!selected_slot_id (
        delivery_periods (start_time, end_time)
      )
    `)
    .eq('id', parcelId)
    .single()

  if (parcelError || !parcel) {
    return NextResponse.json(
      { error: 'Parcel not found' },
      { status: 404 }
    )
  }

  // Check if parcel has a selected slot
  if (!parcel.selected_slot_id) {
    return NextResponse.json(
      { error: 'Parcel does not have a selected delivery slot' },
      { status: 400 }
    )
  }

  // Check if reminder already sent
  if (parcel.delivery_reminder_sent_at) {
    return NextResponse.json(
      { error: 'Delivery reminder already sent', sentAt: parcel.delivery_reminder_sent_at },
      { status: 400 }
    )
  }

  // Send the reminder
  const result = await sendReminderEmail(resend, parcel)

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }

  // Update parcel
  await supabase
    .from('parcels')
    .update({ delivery_reminder_sent_at: new Date().toISOString() })
    .eq('id', parcelId)

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    sentTo: parcel.receiver_email
  })
}

async function sendAllReminders(supabase: any, resend: Resend) {
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

  // Process each parcel
  for (const parcel of parcels) {
    const result = await sendReminderEmail(resend, parcel)

    if (result.success) {
      await supabase
        .from('parcels')
        .update({ delivery_reminder_sent_at: new Date().toISOString() })
        .eq('id', parcel.id)
      results.sent++
    } else {
      results.failed++
      results.errors.push(`${parcel.tracking_number}: ${result.error}`)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Processed ${results.total} parcels: ${results.sent} sent, ${results.failed} failed`,
    results
  })
}

async function sendReminderEmail(resend: Resend, parcel: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Read email template
    const templatePath = join(process.cwd(), 'public', 'email-delivery-day-template.html')
    let emailHtml = readFileSync(templatePath, 'utf-8')

    // Get time window
    const startTime = parcel.region_schedules?.delivery_periods?.start_time?.slice(0, 5) || '??:??'
    const endTime = parcel.region_schedules?.delivery_periods?.end_time?.slice(0, 5) || '??:??'
    const timeWindow = `${startTime} - ${endTime}`

    // Replace placeholders
    emailHtml = emailHtml
      .replace(/{{RECEIVER_NAME}}/g, parcel.receiver_name)
      .replace(/{{TIME_WINDOW}}/g, timeWindow)
      .replace(/{{TRACKING_NUMBER}}/g, parcel.tracking_number)
      .replace(/{{SENDER_COMPANY}}/g, parcel.senders?.company_name || 'Afzender')
      .replace(/{{RECEIVER_ADDRESS}}/g, parcel.receiver_address)
      .replace(/{{POSTAL_CODE}}/g, parcel.receiver_postal_code.toString())

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'SkyNet Belgium <onboarding@resend.dev>',
      to: parcel.receiver_email,
      subject: 'SkyNet bezorgt vandaag uw pakket!',
      html: emailHtml,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
