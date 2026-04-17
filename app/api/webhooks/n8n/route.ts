import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, parcel_id } = body

    if (!parcel_id) {
      return NextResponse.json(
        { error: 'parcel_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get parcel details with all related information
    const { data: parcel, error } = await supabase
      .from('parcels')
      .select(`
        *,
        senders (company_name, email),
        regions (name, color),
        region_schedules (
          day_of_week,
          max_deliveries,
          delivery_periods (name, start_time, end_time),
          drivers (name, phone)
        )
      `)
      .eq('id', parcel_id)
      .single()

    if (error || !parcel) {
      return NextResponse.json(
        { error: 'Parcel not found' },
        { status: 404 }
      )
    }

    const typedParcel = parcel as any

    // Prepare webhook payload for N8N
    const payload = {
      event: event || 'parcel_notification',
      parcel: {
        id: typedParcel.id,
        tracking_number: typedParcel.tracking_number,
        receiver_name: typedParcel.receiver_name,
        receiver_email: typedParcel.receiver_email,
        receiver_phone: typedParcel.receiver_phone,
        receiver_address: typedParcel.receiver_address,
        receiver_postal_code: typedParcel.receiver_postal_code,
        delivery_date: typedParcel.delivery_date,
        status: typedParcel.status,
        secret_link: `${process.env.NEXT_PUBLIC_APP_URL}/select-slot/${typedParcel.secret_token}`,
        token_used: typedParcel.token_used,
      },
      sender: {
        company_name: typedParcel.senders?.company_name || 'Unknown',
        email: typedParcel.senders?.email || '',
      },
      region: typedParcel.regions ? {
        name: typedParcel.regions.name,
        color: typedParcel.regions.color,
      } : null,
      selected_slot: typedParcel.region_schedules ? {
        day_of_week: typedParcel.region_schedules.day_of_week,
        period_name: typedParcel.region_schedules.delivery_periods?.name,
        time_range: `${typedParcel.region_schedules.delivery_periods?.start_time.slice(0, 5)} - ${typedParcel.region_schedules.delivery_periods?.end_time.slice(0, 5)}`,
        driver_name: typedParcel.region_schedules.drivers?.name,
      } : null,
      metadata: {
        created_at: typedParcel.created_at,
        slot_selected_at: typedParcel.slot_selected_at,
      }
    }

    // Return payload for N8N to process
    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to test webhook
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'SkyNet N8N Webhook Endpoint',
    status: 'active',
    usage: 'POST with { event: string, parcel_id: string }',
    events: [
      'parcel_uploaded',
      'slot_selected',
      'status_changed',
      'delivery_completed'
    ]
  })
}