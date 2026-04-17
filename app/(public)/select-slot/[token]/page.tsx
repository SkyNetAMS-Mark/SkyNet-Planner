'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Package, MapPin, CheckCircle2, XCircle, Calendar, Clock } from 'lucide-react'
import { format, startOfWeek } from 'date-fns'

export default function SelectSlotPage() {
  const params = useParams()
  const encodedToken = params.token as string
  const token = decodeURIComponent(encodedToken)
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parcel, setParcel] = useState<any>(null)
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingSlot, setPendingSlot] = useState<any>(null)

  useEffect(() => {
    async function loadParcelAndSlots() {
      try {
        // Verify token and get parcel
        const { data: parcelData, error: parcelError } = await supabase
          .from('parcels')
          .select(`
            *,
            senders (company_name),
            regions (name, color, lead_time_days)
          `)
          .eq('secret_token', token)
          .single()

        if (parcelError || !parcelData) {
          setError('Invalid or expired link. Please contact customer support.')
          setLoading(false)
          return
        }

        const typedParcel = parcelData as any

        // Check if token already used
        if (typedParcel.token_used) {
          setError('This link has already been used. If you need to change your delivery slot, please contact customer support.')
          setLoading(false)
          return
        }

        setParcel(typedParcel)

        // Check if parcel has region assigned
        if (!typedParcel.region_id) {
          setError(`Your postal code (${typedParcel.receiver_postal_code}) is not yet configured in our system. Please contact customer support.`)
          setLoading(false)
          return
        }

        // Get all available slots for this region (no delivery_date needed yet)
        // Note: We fetch all schedules (not just is_active=true) because weekly overrides might enable inactive ones
        const { data: schedules } = await supabase
          .from('region_schedules')
          .select(`
            *,
            delivery_periods (*),
            regions (*),
            drivers (name)
          `)
          .eq('region_id', typedParcel.region_id)
          .order('day_of_week')
          .order('delivery_periods(sort_order)')

        if (!schedules || schedules.length === 0) {
          setError('No delivery slots available for your area. Please contact customer support.')
          setLoading(false)
          return
        }

        // Get lead time from region (default to 0 if not set)
        const leadTimeDays = typedParcel.regions?.lead_time_days || 0

        // Maximum booking window (7 days, or extended if lead time applies)
        const maxBookingDays = 7 + leadTimeDays

        // Fetch weekly overrides for relevant weeks (current week + next 2 weeks)
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
        const nextWeekStart = new Date(currentWeekStart)
        nextWeekStart.setDate(nextWeekStart.getDate() + 7)
        const thirdWeekStart = new Date(nextWeekStart)
        thirdWeekStart.setDate(thirdWeekStart.getDate() + 7)

        const weekStarts = [
          format(currentWeekStart, 'yyyy-MM-dd'),
          format(nextWeekStart, 'yyyy-MM-dd'),
          format(thirdWeekStart, 'yyyy-MM-dd'),
        ]

        // Fetch overrides (table might not exist yet)
        let overrides: any[] = []
        const { data: overridesData, error: overridesError } = await supabase
          .from('weekly_schedule_overrides')
          .select('*')
          .in('week_start', weekStarts)

        if (!overridesError && overridesData) {
          overrides = overridesData
        }

        // Helper to get effective values with overrides
        const getEffectiveSchedule = (schedule: any, weekStartStr: string) => {
          const override = overrides.find(
            o => o.base_schedule_id === schedule.id && o.week_start === weekStartStr
          )

          return {
            maxDeliveries: override?.max_deliveries ?? schedule.max_deliveries,
            isActive: override?.is_active ?? schedule.is_active,
          }
        }

        // Group schedules by day and period, calculate dates and check capacity
        const slotsWithDates = await Promise.all(
          schedules.map(async (schedule: any) => {
            // Calculate actual delivery date
            const targetDayOfWeek = schedule.day_of_week
            const jsDay = today.getDay()
            const currentDayOfWeek = jsDay === 0 ? 7 : jsDay

            // Calculate minimum days ahead (1 day minimum + lead time for remote areas)
            const minimumDaysAhead = 1 + leadTimeDays

            let daysToAdd = targetDayOfWeek - currentDayOfWeek
            if (daysToAdd < 0) daysToAdd += 7
            if (daysToAdd === 0) daysToAdd = 7

            // If daysToAdd is less than minimum required, push to next week
            if (daysToAdd < minimumDaysAhead) {
              daysToAdd += 7
            }

            // Enforce maximum booking window (7 days + lead time)
            if (daysToAdd > maxBookingDays) {
              return null // Skip slots beyond booking window
            }

            const deliveryDate = new Date(today)
            deliveryDate.setDate(today.getDate() + daysToAdd)
            const deliveryDateStr = deliveryDate.toISOString().split('T')[0]

            // Get the week start for this delivery date to check for overrides
            const deliveryWeekStart = startOfWeek(deliveryDate, { weekStartsOn: 1 })
            const deliveryWeekStartStr = format(deliveryWeekStart, 'yyyy-MM-dd')

            // Get effective schedule values (base + override)
            const effective = getEffectiveSchedule(schedule, deliveryWeekStartStr)

            // Skip if slot is not active (base or override)
            if (!effective.isActive) {
              return null
            }

            // Check capacity for this slot on this date
            const { count } = await supabase
              .from('parcels')
              .select('*', { count: 'exact', head: true })
              .eq('selected_slot_id', schedule.id)
              .eq('delivery_date', deliveryDateStr)
              .not('status', 'in', '(cancelled,failed)')

            const currentCount = count || 0
            const available = effective.maxDeliveries - currentCount

            return {
              ...schedule,
              delivery_date: deliveryDate,
              delivery_date_str: deliveryDateStr,
              current_count: currentCount,
              max_deliveries: effective.maxDeliveries, // Override the base value
              available,
              is_full: available <= 0,
              days_ahead: daysToAdd,
            }
          })
        )

        // Filter out null slots (beyond booking window) and full slots
        const validSlots = slotsWithDates.filter(s => s !== null) as any[]
        const available = validSlots.filter(s => !s.is_full)

        if (available.length === 0) {
          // No slots available - show helpful message
          const allFull = validSlots.length > 0 && validSlots.every(s => s.is_full)
          if (allFull) {
            setError('All delivery slots are currently full. Please reply to the email you received or contact SkyNet customer support.')
          } else {
            setError('No delivery slots are available in the coming 7 days for your area. Please reply to the email you received or contact SkyNet customer support to arrange delivery.')
          }
          setLoading(false)
          return
        }

        setAvailableSlots(available)
        setLoading(false)
      } catch (err) {
        console.error('Error loading slots:', err)
        setError('An unexpected error occurred. Please try again later.')
        setLoading(false)
      }
    }

    loadParcelAndSlots()
  }, [token, supabase])

  // Open confirmation dialog with selected slot
  const handleSlotClick = (slotId: string) => {
    const slot = availableSlots.find(s => s.id === slotId)
    if (!slot) return
    setPendingSlot(slot)
    setConfirmDialogOpen(true)
  }

  // Actually confirm and book the slot
  const handleConfirmSlot = async () => {
    if (!pendingSlot) return

    setSelecting(true)
    setError(null)
    setConfirmDialogOpen(false)

    try {
      // Double-check capacity
      const { count } = await supabase
        .from('parcels')
        .select('*', { count: 'exact', head: true })
        .eq('selected_slot_id', pendingSlot.id)
        .eq('delivery_date', pendingSlot.delivery_date_str)
        .not('status', 'in', '(cancelled,failed)')

      if ((count || 0) >= pendingSlot.max_deliveries) {
        setError('This slot just became full. Please select another slot.')
        setSelecting(false)
        setPendingSlot(null)
        window.location.reload()
        return
      }

      // Update parcel
      const { error: updateError } = await (supabase as any)
        .from('parcels')
        .update({
          selected_slot_id: pendingSlot.id,
          delivery_date: pendingSlot.delivery_date_str,
          status: 'slot_selected',
          token_used: true,
          slot_selected_at: new Date().toISOString(),
        })
        .eq('id', parcel.id)

      if (updateError) {
        setError('Failed to confirm your selection. Please try again.')
        setSelecting(false)
        setPendingSlot(null)
        return
      }

      setSelectedSlot(pendingSlot.id)
      setConfirmed(true)
      setSelecting(false)
      setPendingSlot(null)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setSelecting(false)
      setPendingSlot(null)
    }
  }

  // Cancel confirmation dialog
  const handleCancelConfirm = () => {
    setConfirmDialogOpen(false)
    setPendingSlot(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading your delivery options...</p>
        </div>
      </div>
    )
  }

  if (error && !parcel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-center">Unable to Load</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (confirmed) {
    const confirmedSlot = availableSlots.find(s => s.id === selectedSlot)
    
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-center text-2xl">Delivery Slot Confirmed!</CardTitle>
            <CardDescription className="text-center">
              Your parcel delivery has been scheduled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-gray-50 p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600">Tracking Number</p>
                <p className="font-mono font-semibold text-lg">{parcel.tracking_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Delivery Date</p>
                  <p className="font-semibold">{format(confirmedSlot?.delivery_date, 'EEEE, MMMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time Window</p>
                  <p className="font-semibold">
                    {confirmedSlot?.delivery_periods?.start_time.slice(0, 5)} - {confirmedSlot?.delivery_periods?.end_time.slice(0, 5)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Delivery Region</p>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: parcel.regions?.color,
                    color: parcel.regions?.color,
                  }}
                >
                  {parcel.regions?.name}
                </Badge>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                <strong>What's next?</strong> You'll receive a confirmation email shortly. 
                We'll notify you when your parcel is out for delivery.
              </AlertDescription>
            </Alert>

            <div className="text-center text-sm text-gray-600">
              <p>Questions? Contact us at support@skynet.be</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get unique dates from available slots (sorted chronologically)
  const uniqueDates = [...new Set(availableSlots.map(s => s.delivery_date_str))]
    .sort()
    .map(dateStr => {
      const slot = availableSlots.find(s => s.delivery_date_str === dateStr)
      return {
        dateStr,
        date: slot?.delivery_date,
        dayName: format(new Date(dateStr + 'T12:00:00'), 'EEEE')
      }
    })

  // Get unique periods
  const periods = Array.from(new Set(availableSlots.map(s => s.delivery_periods?.name)))
    .map(name => {
      const slot = availableSlots.find(s => s.delivery_periods?.name === name)
      return {
        name,
        start_time: slot?.delivery_periods?.start_time,
        end_time: slot?.delivery_periods?.end_time,
        sort_order: slot?.delivery_periods?.sort_order || 0
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)

  // Create calendar matrix based on actual available dates
  const calendarMatrix = periods.map(period => ({
    period,
    slots: uniqueDates.map(dateInfo => {
      const slot = availableSlots.find(s =>
        s.delivery_date_str === dateInfo.dateStr &&
        s.delivery_periods?.name === period.name
      )
      return {
        dateInfo,
        slot
      }
    })
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 py-12 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600">
            <Package className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Select Your Delivery Slot</h1>
          <p className="text-gray-600 mt-2">
            Choose a convenient day and time for your parcel delivery
          </p>
        </div>

        {/* Parcel Info */}
        <Card>
          <CardHeader>
            <CardTitle>Parcel Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-gray-600">Tracking Number</p>
                <p className="font-mono font-semibold">{parcel.tracking_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">From</p>
                <p className="font-semibold">{parcel.senders?.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Region</p>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: parcel.regions?.color,
                    color: parcel.regions?.color,
                  }}
                >
                  {parcel.regions?.name}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar View */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Delivery Slots</h2>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-gray-700 min-w-[120px]">Time</th>
                      {uniqueDates.map(dateInfo => (
                        <th key={dateInfo.dateStr} className="text-center p-3 font-medium text-gray-700 min-w-[140px]">
                          <div>{dateInfo.dayName}</div>
                          <div className="text-xs font-normal text-gray-500">
                            {format(new Date(dateInfo.dateStr + 'T12:00:00'), 'MMM dd')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarMatrix.map(({ period, slots }) => (
                      <tr key={period.name} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium">{period.name}</div>
                          <div className="text-xs text-gray-600">
                            {period.start_time?.slice(0, 5)} - {period.end_time?.slice(0, 5)}
                          </div>
                        </td>
                        {slots.map(({ dateInfo, slot }) => (
                          <td key={dateInfo.dateStr} className="p-3 text-center">
                            {slot ? (
                              <button
                                onClick={() => !selecting && handleSlotClick(slot.id)}
                                disabled={selecting}
                                className="w-full rounded-lg border-2 border-indigo-200 bg-indigo-50 p-3 hover:border-indigo-400 hover:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <div className="text-xs text-indigo-700">
                                  {slot.available} spots left
                                </div>
                                {slot.drivers && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {slot.drivers.name}
                                  </div>
                                )}
                              </button>
                            ) : (
                              <div className="w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-3 text-gray-400 text-sm">
                                Not available
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Important Information</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Click on any available slot to select it</li>
                  <li>Please be available during the selected time window</li>
                  <li>You'll receive a notification when the driver is on the way</li>
                  <li>This selection is final and cannot be changed online</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>Powered by SkyNet Belgium</p>
          <p className="mt-1">Questions? Email us at support@skynet.be</p>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Confirm Your Delivery Slot
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to select this time window for your delivery?
            </DialogDescription>
          </DialogHeader>

          {pendingSlot && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-sm text-gray-600">Delivery Date</p>
                  <p className="font-semibold text-gray-900">
                    {format(pendingSlot.delivery_date, 'EEEE, MMMM dd, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-sm text-gray-600">Time Window</p>
                  <p className="font-semibold text-gray-900">
                    {pendingSlot.delivery_periods?.start_time?.slice(0, 5)} - {pendingSlot.delivery_periods?.end_time?.slice(0, 5)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-sm text-gray-600">Region</p>
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: parcel?.regions?.color,
                      color: parcel?.regions?.color,
                    }}
                  >
                    {parcel?.regions?.name}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-900 text-sm">
              This selection is final and cannot be changed online. Please ensure you will be available during this time window.
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              disabled={selecting}
            >
              Choose Different Slot
            </Button>
            <Button
              onClick={handleConfirmSlot}
              disabled={selecting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {selecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Confirm Selection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}