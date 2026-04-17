'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, Package, User, MapPin, Calendar, Clock, Truck, Copy, ExternalLink, Mail, Bell } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ParcelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const parcelId = params.id as string

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parcel, setParcel] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')

  useEffect(() => {
    async function loadParcel() {
      const { data, error: fetchError } = await supabase
        .from('parcels')
        .select(`
          *,
          senders (company_name, email),
          regions (name, color),
          region_schedules (
            id,
            day_of_week,
            max_deliveries,
            delivery_periods (name, start_time, end_time),
            drivers (name, phone)
          )
        `)
        .eq('id', parcelId)
        .single()

      if (fetchError || !data) {
        setError('Parcel not found')
        setLoading(false)
        return
      }

      setParcel(data)

      const typedData = data as any

      // Load history
      const { data: historyData } = await supabase
        .from('parcel_history')
        .select('*')
        .eq('parcel_id', parcelId)
        .order('created_at', { ascending: false })

      if (historyData) {
        setHistory(historyData)
      }

      // Load available slots for manual override - load ALL slots for the region
      if (typedData.region_id) {
        const { data: slots } = await supabase
          .from('region_schedules')
          .select(`
            *,
            delivery_periods (name, start_time, end_time, sort_order),
            regions (name)
          `)
          .eq('region_id', typedData.region_id)
          .eq('is_active', true)
          .order('day_of_week')
          .order('delivery_periods(sort_order)')

        if (slots) {
          setAvailableSlots(slots)
        }
      }

      // Set current selected slot
      if (typedData.selected_slot_id) {
        setSelectedSlotId(typedData.selected_slot_id)
      }

      setLoading(false)
    }

    loadParcel()
  }, [parcelId, supabase])

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true)
    setError(null)

    const { error: updateError } = await (supabase as any)
      .from('parcels')
      .update({ status: newStatus })
      .eq('id', parcelId)

    if (updateError) {
      setError(updateError.message)
      setUpdating(false)
      return
    }

    // Reload parcel
    window.location.reload()
  }

  const handleSlotOverride = async (slotId: string) => {
    if (!confirm('Are you sure you want to manually assign this delivery slot?')) {
      return
    }

    setUpdating(true)
    setError(null)

    // Get the selected slot to calculate delivery date
    const selectedSlot = availableSlots.find((s: any) => s.id === slotId)
    if (!selectedSlot) {
      setError('Invalid slot selection')
      setUpdating(false)
      return
    }

    // Calculate delivery date based on day_of_week
    // Database uses: 1=Monday, 2=Tuesday, ..., 7=Sunday
    // JavaScript Date.getDay() uses: 0=Sunday, 1=Monday, ..., 6=Saturday
    const today = new Date()
    today.setHours(12, 0, 0, 0) // Set to noon to avoid timezone issues
    
    const targetDayOfWeek = (selectedSlot as any).day_of_week // 1-7 (Mon-Sun)
    
    // Convert current day to 1-7 format (Monday=1, Sunday=7)
    const jsDay = today.getDay() // 0-6 (Sun-Sat)
    const currentDayOfWeek = jsDay === 0 ? 7 : jsDay // Convert: Sun=7, Mon=1, etc.
    
    let daysToAdd = targetDayOfWeek - currentDayOfWeek
    if (daysToAdd < 0) daysToAdd += 7 // Next week if day has passed
    if (daysToAdd === 0) daysToAdd = 7 // If same day, schedule for next week
    
    const deliveryDate = new Date(today)
    deliveryDate.setDate(today.getDate() + daysToAdd)
    
    // Format as YYYY-MM-DD in local timezone
    const year = deliveryDate.getFullYear()
    const month = String(deliveryDate.getMonth() + 1).padStart(2, '0')
    const day = String(deliveryDate.getDate()).padStart(2, '0')
    const deliveryDateStr = `${year}-${month}-${day}`

    console.log('Assigning slot:', {
      slotId,
      targetDayOfWeek,
      currentDayOfWeek,
      daysToAdd,
      deliveryDateStr,
      slotName: (selectedSlot as any).delivery_periods?.name
    })

    const { data: updateData, error: updateError } = await (supabase as any)
      .from('parcels')
      .update({
        selected_slot_id: slotId,
        delivery_date: deliveryDateStr,
        status: 'slot_selected',
        token_used: true,
      })
      .eq('id', parcelId)
      .select()

    if (updateError) {
      console.error('Update error:', updateError)
      setError(updateError.message)
      setUpdating(false)
      return
    }

    console.log('Update successful:', updateData)
    toast.success(`Delivery slot assigned for ${format(new Date(deliveryDateStr), 'EEEE, MMM dd')}`)
    
    // Force a hard reload to ensure fresh data
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const copyCustomerLink = () => {
    const encodedToken = encodeURIComponent(parcel.secret_token)
    const link = `${window.location.origin}/select-slot/${encodedToken}`
    navigator.clipboard.writeText(link)
    toast.success('Customer link copied to clipboard!')
  }

  const openCustomerLink = () => {
    const encodedToken = encodeURIComponent(parcel.secret_token)
    const link = `${window.location.origin}/select-slot/${encodedToken}`
    window.open(link, '_blank')
  }

  const handleSendInvite = async () => {
    setSendingInvite(true)
    setError(null)

    try {
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId: parcel.id })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send invite')
        setSendingInvite(false)
        return
      }

      toast.success(`Invite email sent to ${data.sentTo}`)
      
      // Reload parcel to update invite_sent_at status
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      setError('Failed to send invite: ' + err.message)
      setSendingInvite(false)
    }
  }

  const handleSendReminder = async () => {
    setSendingReminder(true)
    setError(null)

    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId: parcel.id })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reminder')
        setSendingReminder(false)
        return
      }

      toast.success(`Reminder email sent to ${data.sentTo} (Reminder #${data.reminderCount})`)
      
      // Reload parcel to update reminder_sent_at status
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      setError('Failed to send reminder: ' + err.message)
      setSendingReminder(false)
    }
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    slot_selected: 'bg-blue-100 text-blue-800',
    in_transit: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error && !parcel) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Link href="/parcels">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Parcels
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/parcels">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Parcel Details</h1>
          <p className="text-gray-600 mt-1 font-mono">{parcel.tracking_number}</p>
        </div>
        <Badge className={statusColors[parcel.status as keyof typeof statusColors]}>
          {parcel.status.replace('_', ' ')}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Receiver Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Receiver Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{parcel.receiver_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold">{parcel.receiver_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-semibold">{parcel.receiver_phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Postal Code</p>
                <p className="font-semibold font-mono">{parcel.receiver_postal_code}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-semibold">{parcel.receiver_address}</p>
            </div>
          </CardContent>
        </Card>

        {/* Sender Information */}
        <Card>
          <CardHeader>
            <CardTitle>Sender</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-gray-600">Company</p>
              <p className="font-semibold">{parcel.senders?.company_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="text-sm">{parcel.senders?.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Delivery Information */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parcel.delivery_date ? (
              <div>
                <p className="text-sm text-gray-600">Delivery Date</p>
                <p className="font-semibold">{format(new Date(parcel.delivery_date), 'EEEE, MMMM dd, yyyy')}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Delivery Date</p>
                <Badge variant="secondary">Not selected yet</Badge>
              </div>
            )}
            {parcel.regions && (
              <div>
                <p className="text-sm text-gray-600">Region</p>
                <Badge
                  variant="outline"
                  style={{
                    borderColor: parcel.regions.color,
                    color: parcel.regions.color,
                  }}
                >
                  {parcel.regions.name}
                </Badge>
              </div>
            )}
            {parcel.region_schedules && (
              <div>
                <p className="text-sm text-gray-600">Time Slot</p>
                <p className="font-semibold">
                  {parcel.region_schedules.delivery_periods?.name} (
                  {parcel.region_schedules.delivery_periods?.start_time.slice(0, 5)} - 
                  {parcel.region_schedules.delivery_periods?.end_time.slice(0, 5)})
                </p>
                {parcel.region_schedules.drivers && (
                  <p className="text-sm text-gray-600 mt-1">
                    Driver: {parcel.region_schedules.drivers.name}
                  </p>
                )}
              </div>
            )}
            {parcel.weight_kg && (
              <div>
                <p className="text-sm text-gray-600">Weight</p>
                <p className="font-semibold">{parcel.weight_kg} kg</p>
              </div>
            )}
            {parcel.dimensions_cm && (
              <div>
                <p className="text-sm text-gray-600">Dimensions</p>
                <p className="font-semibold">{parcel.dimensions_cm} cm</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Update Status */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Update Status</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate('in_transit')}
                  disabled={updating || parcel.status === 'in_transit'}
                >
                  In Transit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate('delivered')}
                  disabled={updating || parcel.status === 'delivered'}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  Delivered
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate('failed')}
                  disabled={updating}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Failed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate('cancelled')}
                  disabled={updating}
                >
                  Cancelled
                </Button>
              </div>
            </div>

            {/* Email Actions */}
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Email Notifications</p>
              
              {/* Send Invite Button */}
              <Button
                size="sm"
                onClick={handleSendInvite}
                disabled={sendingInvite || sendingReminder || !!parcel.invite_sent_at}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {sendingInvite ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Invite...
                  </>
                ) : parcel.invite_sent_at ? (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Invite Sent ({format(new Date(parcel.invite_sent_at), 'MMM dd, HH:mm')})
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Slot Selection Invite
                  </>
                )}
              </Button>

              {/* Send Reminder Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSendReminder}
                disabled={sendingReminder || sendingInvite || !parcel.invite_sent_at || parcel.status === 'slot_selected'}
                className="w-full"
              >
                {sendingReminder ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reminder...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Send Reminder {parcel.reminder_count > 0 ? `(#${parcel.reminder_count + 1})` : ''}
                  </>
                )}
              </Button>

              {parcel.reminder_sent_at && (
                <p className="text-xs text-gray-500">
                  Last reminder: {format(new Date(parcel.reminder_sent_at), 'MMM dd, yyyy HH:mm')}
                </p>
              )}
            </div>

            {/* Customer Link */}
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Customer Selection Link</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyCustomerLink}
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openCustomerLink}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Manual link sharing (emails are sent via buttons above)
              </p>
            </div>

            {/* Manual Slot Assignment */}
            {availableSlots.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Assign Delivery Slot (Admin)</p>
                <Select
                  value={selectedSlotId || undefined}
                  onValueChange={handleSlotOverride}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot: any) => (
                      <SelectItem key={slot.id} value={slot.id}>
                        {DAYS[slot.day_of_week]} - {slot.delivery_periods?.name} (
                        {slot.delivery_periods?.start_time.slice(0, 5)} -
                        {slot.delivery_periods?.end_time.slice(0, 5)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Manually assign a slot - delivery date will be calculated automatically
                </p>
              </div>
            )}

            {/* Token Info */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600">Token Status</p>
              <Badge variant={parcel.token_used ? 'default' : 'secondary'}>
                {parcel.token_used ? 'Used' : 'Not Used'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
          <CardDescription>Timeline of all status changes</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No history available</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, index) => (
                <div key={entry.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-indigo-100' : 'bg-gray-100'
                    }`}>
                      <Package className={`h-4 w-4 ${
                        index === 0 ? 'text-indigo-600' : 'text-gray-400'
                      }`} />
                    </div>
                    {index < history.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">{entry.status}</p>
                    {entry.notes && (
                      <p className="text-sm text-gray-600">{entry.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {(parcel.notes || parcel.special_instructions) && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {parcel.notes && (
              <div>
                <p className="text-sm text-gray-600">Notes</p>
                <p className="text-sm">{parcel.notes}</p>
              </div>
            )}
            {parcel.special_instructions && (
              <div>
                <p className="text-sm text-gray-600">Special Instructions</p>
                <p className="text-sm">{parcel.special_instructions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}