import { createClient } from '@/lib/supabase/server'

export async function getAvailableSlots(
  postalCode: number,
  deliveryDate: Date
) {
  const supabase = await createClient()
  
  // Get day of week (1-7, Monday-Sunday)
  const dayOfWeek = deliveryDate.getDay() === 0 ? 7 : deliveryDate.getDay()
  
  // Find region from postal code
  const { data: postalCodeData } = await supabase
    .from('postal_codes')
    .select('region_id, regions (id, name, color)')
    .eq('code', postalCode)
    .single()

  if (!postalCodeData) {
    return { error: 'Postal code not found or not serviced', slots: [] }
  }

  const typedPostalCode = postalCodeData as any

  // Get schedules for this region and day
  const { data: schedules } = await supabase
    .from('region_schedules')
    .select(`
      *,
      delivery_periods (*),
      regions (*),
      drivers (id, name)
    `)
    .eq('region_id', typedPostalCode.region_id)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .order('delivery_periods(sort_order)')

  if (!schedules || schedules.length === 0) {
    return { error: 'No delivery slots available for this date', slots: [] }
  }

  // Check capacity for each slot
  const slotsWithCapacity = await Promise.all(
    schedules.map(async (schedule: any) => {
      const { count } = await supabase
        .from('parcels')
        .select('*', { count: 'exact', head: true })
        .eq('selected_slot_id', schedule.id)
        .eq('delivery_date', deliveryDate.toISOString().split('T')[0])
        .not('status', 'in', '(cancelled,failed)')

      const currentCount = count || 0
      const available = schedule.max_deliveries - currentCount
      const isFull = available <= 0

      return {
        id: schedule.id,
        region: schedule.regions,
        period: schedule.delivery_periods,
        driver: schedule.drivers,
        max_deliveries: schedule.max_deliveries,
        current_count: currentCount,
        available,
        is_full: isFull,
        utilization_percentage: Math.round((currentCount / schedule.max_deliveries) * 100),
      }
    })
  )

  // Filter out full slots
  const availableSlots = slotsWithCapacity.filter((slot) => !slot.is_full)

  return { error: null, slots: availableSlots }
}

export async function selectSlot(token: string, slotId: string) {
  const supabase = await createClient()

  // Verify token is valid and not used
  const { data: parcel, error: parcelError } = await supabase
    .from('parcels')
    .select('*')
    .eq('secret_token', token)
    .eq('token_used', false)
    .single()

  if (parcelError || !parcel) {
    return { error: 'Invalid or expired token', success: false }
  }

  const typedParcel = parcel as any

  // Check if slot is still available
  const { count } = await supabase
    .from('parcels')
    .select('*', { count: 'exact', head: true })
    .eq('selected_slot_id', slotId)
    .eq('delivery_date', typedParcel.delivery_date)
    .not('status', 'in', '(cancelled,failed)')

  const { data: schedule } = await supabase
    .from('region_schedules')
    .select('max_deliveries')
    .eq('id', slotId)
    .single()

  const typedSchedule = schedule as any

  if (!typedSchedule || (count || 0) >= typedSchedule.max_deliveries) {
    return { error: 'Selected slot is no longer available', success: false }
  }

  // Update parcel with selected slot
  const { error: updateError } = await (supabase as any)
    .from('parcels')
    .update({
      selected_slot_id: slotId,
      status: 'slot_selected',
      token_used: true,
      slot_selected_at: new Date().toISOString(),
    })
    .eq('id', typedParcel.id)

  if (updateError) {
    return { error: updateError.message, success: false }
  }

  return { error: null, success: true, parcel: typedParcel }
}