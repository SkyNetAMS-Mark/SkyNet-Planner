import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Initialize Resend inside the function to avoid build-time errors
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { parcelId } = await request.json()

    if (!parcelId) {
      return NextResponse.json(
        { error: 'Parcel ID is required' },
        { status: 400 }
      )
    }

    // Fetch parcel details
    const supabase = await createClient()
    const { data: parcel, error: parcelError } = await supabase
      .from('parcels')
      .select(`
        *,
        senders (company_name)
      `)
      .eq('id', parcelId)
      .single()

    if (parcelError || !parcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    const typedParcel = parcel as any

    // Check if invite already sent
    if (typedParcel.invite_sent_at) {
      return NextResponse.json(
        { error: 'Invite already sent for this parcel' },
        { status: 400 }
      )
    }

    // Read email template
    const templatePath = join(process.cwd(), 'public', 'email-invite-template.html')
    let emailHtml = readFileSync(templatePath, 'utf-8')

    // Replace placeholders
    const slotSelectionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/select-slot/${typedParcel.secret_token}`
    
    emailHtml = emailHtml
      .replace(/{{RECEIVER_NAME}}/g, typedParcel.receiver_name)
      .replace(/{{SENDER_COMPANY}}/g, typedParcel.senders?.company_name || 'Unknown Sender')
      .replace(/{{POSTAL_CODE}}/g, typedParcel.receiver_postal_code.toString())
      .replace(/{{SLOT_SELECTION_URL}}/g, slotSelectionUrl)
      .replace(/{{TRACKING_NUMBER}}/g, typedParcel.tracking_number)
      .replace(/{{RECEIVER_ADDRESS}}/g, typedParcel.receiver_address)

    // Send email via Resend
    // Note: Using Resend's testing domain until skynet.be is verified
    // To use skynet.be, add and verify the domain at https://resend.com/domains
    const { data, error } = await resend.emails.send({
      from: 'SkyNet Belgium <onboarding@resend.dev>',
      to: typedParcel.receiver_email,
      subject: 'Choose Your SkyNet Delivery Slot',
      html: emailHtml,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send email: ' + error.message },
        { status: 500 }
      )
    }

    // Update parcel to mark invite as sent (keep status as 'pending')
    const { error: updateError } = await (supabase as any)
      .from('parcels')
      .update({
        invite_sent_at: new Date().toISOString()
      })
      .eq('id', parcelId)

    if (updateError) {
      console.error('Failed to update parcel:', updateError)
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      sentTo: typedParcel.receiver_email
    })

  } catch (error: any) {
    console.error('Send invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    )
  }
}