'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Trash2, Calendar, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO, startOfWeek, isSameWeek } from 'date-fns'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

type WeeklyOverride = {
  id: string
  base_schedule_id: string
  week_start: string
  max_deliveries: number | null
  is_active: boolean | null
  notes: string | null
}

export default function EditSchedulePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const scheduleId = params.id as string

  // Check if we're editing for a specific week
  const weekParam = searchParams.get('week')
  const selectedWeek = weekParam ? parseISO(weekParam) : null
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isCurrentWeek = selectedWeek && isSameWeek(selectedWeek, currentWeekStart, { weekStartsOn: 1 })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removingOverride, setRemovingOverride] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([])
  const [parcelCount, setParcelCount] = useState(0)
  const [assignedParcels, setAssignedParcels] = useState<any[]>([])
  const [existingOverride, setExistingOverride] = useState<WeeklyOverride | null>(null)

  // Base schedule data
  const [baseData, setBaseData] = useState({
    region_name: '',
    day_of_week: '',
    period_name: '',
    max_deliveries: '',
    driver_id: '',
    is_active: true,
    notes: '',
  })

  // Form data (can be override or base)
  const [formData, setFormData] = useState({
    max_deliveries: '',
    driver_id: '',
    is_active: true,
    notes: '',
  })

  useEffect(() => {
    async function loadData() {
      // Load base schedule
      const { data: schedule, error: scheduleError } = await supabase
        .from('region_schedules')
        .select(`
          *,
          regions (name),
          delivery_periods (name, start_time, end_time),
          drivers (id, name)
        `)
        .eq('id', scheduleId)
        .single()

      if (scheduleError || !schedule) {
        setError('Schedule not found')
        setLoading(false)
        return
      }

      const scheduleData = schedule as any

      // Set base data
      setBaseData({
        region_name: scheduleData.regions?.name || '',
        day_of_week: schedule.day_of_week.toString(),
        period_name: scheduleData.delivery_periods?.name || '',
        max_deliveries: schedule.max_deliveries.toString(),
        driver_id: schedule.driver_id || '',
        is_active: schedule.is_active,
        notes: schedule.notes || '',
      })

      // Load drivers
      const { data: driversData } = await supabase
        .from('drivers')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (driversData) {
        setDrivers(driversData)
      }

      // Count parcels assigned to this slot
      const { data: parcelsData, count } = await supabase
        .from('parcels')
        .select('id, tracking_number, receiver_name, status, delivery_date')
        .eq('selected_slot_id', scheduleId)
        .not('status', 'in', '(cancelled,failed,delivered)')

      setParcelCount(count || 0)
      setAssignedParcels(parcelsData || [])

      // If viewing a specific week, check for existing override
      if (selectedWeek) {
        const weekStr = format(selectedWeek, 'yyyy-MM-dd')
        const { data: override, error: overrideError } = await supabase
          .from('weekly_schedule_overrides')
          .select('*')
          .eq('base_schedule_id', scheduleId)
          .eq('week_start', weekStr)
          .single()

        if (!overrideError && override) {
          setExistingOverride(override as WeeklyOverride)
          // Use override values
          setFormData({
            max_deliveries: (override.max_deliveries ?? schedule.max_deliveries).toString(),
            driver_id: schedule.driver_id || '', // Driver not overridable per requirements
            is_active: override.is_active ?? schedule.is_active,
            notes: override.notes || '',
          })
        } else {
          // No override, use base values
          setFormData({
            max_deliveries: schedule.max_deliveries.toString(),
            driver_id: schedule.driver_id || '',
            is_active: schedule.is_active,
            notes: '',
          })
        }
      } else {
        // Base template editing
        setFormData({
          max_deliveries: schedule.max_deliveries.toString(),
          driver_id: schedule.driver_id || '',
          is_active: schedule.is_active,
          notes: schedule.notes || '',
        })
      }

      setLoading(false)
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, weekParam]) // Don't include supabase - it's recreated each render

  const handleSaveBase = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const maxDeliveries = parseInt(formData.max_deliveries)
    if (maxDeliveries < parcelCount && !selectedWeek) {
      setError(`Cannot set max deliveries below ${parcelCount} (current parcels assigned)`)
      setSaving(false)
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('region_schedules')
        .update({
          max_deliveries: maxDeliveries,
          driver_id: formData.driver_id || null,
          is_active: formData.is_active,
          notes: formData.notes || null,
        })
        .eq('id', scheduleId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      setSuccess('Base template saved successfully')
      setTimeout(() => {
        router.push('/schedules')
        router.refresh()
      }, 1000)
    } catch (err) {
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const handleSaveWeekOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWeek) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const weekStr = format(selectedWeek, 'yyyy-MM-dd')
    const maxDeliveries = parseInt(formData.max_deliveries)

    // Check if values are different from base
    const isDifferentFromBase =
      maxDeliveries !== parseInt(baseData.max_deliveries) ||
      formData.is_active !== baseData.is_active

    if (!isDifferentFromBase && !formData.notes) {
      // No changes from base, remove override if exists
      if (existingOverride) {
        const { error: deleteError } = await supabase
          .from('weekly_schedule_overrides')
          .delete()
          .eq('id', existingOverride.id)

        if (deleteError) {
          setError(deleteError.message)
          setSaving(false)
          return
        }
      }

      setSuccess('Override removed (values match base template)')
      setTimeout(() => {
        router.push(`/schedules?week=${weekStr}`)
        router.refresh()
      }, 1000)
      return
    }

    try {
      if (existingOverride) {
        // Update existing override
        const { error: updateError } = await supabase
          .from('weekly_schedule_overrides')
          .update({
            max_deliveries: maxDeliveries !== parseInt(baseData.max_deliveries) ? maxDeliveries : null,
            is_active: formData.is_active !== baseData.is_active ? formData.is_active : null,
            notes: formData.notes || null,
          })
          .eq('id', existingOverride.id)

        if (updateError) {
          setError(updateError.message)
          setSaving(false)
          return
        }
      } else {
        // Create new override
        const { error: insertError } = await supabase
          .from('weekly_schedule_overrides')
          .insert({
            base_schedule_id: scheduleId,
            week_start: weekStr,
            max_deliveries: maxDeliveries !== parseInt(baseData.max_deliveries) ? maxDeliveries : null,
            is_active: formData.is_active !== baseData.is_active ? formData.is_active : null,
            notes: formData.notes || null,
          })

        if (insertError) {
          // Table might not exist yet
          if (insertError.message.includes('does not exist')) {
            setError('Weekly overrides table not yet created. Please run the migration SQL first.')
          } else {
            setError(insertError.message)
          }
          setSaving(false)
          return
        }
      }

      setSuccess('Weekly override saved successfully')
      setTimeout(() => {
        router.push(`/schedules?week=${weekStr}`)
        router.refresh()
      }, 1000)
    } catch (err) {
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const handleRemoveOverride = async () => {
    if (!existingOverride) return

    setRemovingOverride(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('weekly_schedule_overrides')
        .delete()
        .eq('id', existingOverride.id)

      if (deleteError) {
        setError(deleteError.message)
        setRemovingOverride(false)
        return
      }

      setSuccess('Override removed, reverting to base template')
      setExistingOverride(null)
      // Reset form to base values
      setFormData({
        max_deliveries: baseData.max_deliveries,
        driver_id: baseData.driver_id,
        is_active: baseData.is_active,
        notes: '',
      })
      setRemovingOverride(false)
    } catch (err) {
      setError('An unexpected error occurred')
      setRemovingOverride(false)
    }
  }

  const handleDelete = async () => {
    if (parcelCount > 0) {
      setError(`Cannot delete schedule with ${parcelCount} assigned parcel(s). Please reassign them first.`)
      return
    }

    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('region_schedules')
        .delete()
        .eq('id', scheduleId)

      if (deleteError) {
        setError(deleteError.message)
        setDeleting(false)
        return
      }

      router.push('/schedules')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const backUrl = selectedWeek ? `/schedules?week=${format(selectedWeek, 'yyyy-MM-dd')}` : '/schedules'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backUrl}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Schedule</h1>
            <p className="text-gray-600 mt-1">
              {baseData.region_name} - {DAYS.find(d => d.value.toString() === baseData.day_of_week)?.label} {baseData.period_name}
            </p>
          </div>
        </div>
        {!selectedWeek && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || saving || parcelCount > 0}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Schedule
              </>
            )}
          </Button>
        )}
      </div>

      {/* Week Context Banner */}
      {selectedWeek && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">
                    Editing for Week of {format(selectedWeek, 'MMM d, yyyy')}
                    {isCurrentWeek && ' (Current Week)'}
                  </p>
                  <p className="text-sm text-amber-700">
                    {existingOverride
                      ? 'This week has a custom override. Changes will update the override.'
                      : 'No override exists for this week. Saving will create a new override.'}
                  </p>
                </div>
              </div>
              {existingOverride && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveOverride}
                  disabled={removingOverride}
                  className="border-amber-300 hover:bg-amber-100"
                >
                  {removingOverride ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  )}
                  Revert to Base
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      {parcelCount > 0 && (
        <Alert>
          <AlertDescription>
            <p className="font-medium mb-2">
              This schedule has {parcelCount} parcel(s) currently assigned:
            </p>
            <ul className="text-sm space-y-1">
              {assignedParcels.map((p) => (
                <li key={p.id}>
                  <Link href={`/parcels/${p.id}`} className="text-indigo-600 hover:underline">
                    {p.tracking_number}
                  </Link>
                  {' - '}{p.receiver_name} ({p.status})
                  {p.delivery_date && ` - ${p.delivery_date}`}
                </li>
              ))}
            </ul>
            {!selectedWeek && (
              <p className="mt-2 text-sm">
                You must reassign or delete these parcels before deleting this schedule.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            {selectedWeek ? 'Weekly Override' : 'Base Schedule Configuration'}
          </CardTitle>
          <CardDescription>
            {selectedWeek
              ? 'Modify capacity for this specific week only'
              : 'Update the default capacity and settings'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={selectedWeek ? handleSaveWeekOverride : handleSaveBase} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Read-only fields */}
            <div className="space-y-4 rounded-lg bg-gray-50 p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">Route</Label>
                  <p className="font-medium">{baseData.region_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Day</Label>
                  <p className="font-medium">
                    {DAYS.find(d => d.value.toString() === baseData.day_of_week)?.label}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Period</Label>
                  <p className="font-medium">{baseData.period_name}</p>
                </div>
              </div>
            </div>

            {/* Show base template values when editing override */}
            {selectedWeek && (
              <div className="space-y-2 rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-600 uppercase">Base Template Values</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Max Deliveries:</span>{' '}
                    <span className="font-medium">{baseData.max_deliveries}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>{' '}
                    <Badge variant={baseData.is_active ? 'default' : 'secondary'} className="ml-1">
                      {baseData.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Max Deliveries */}
            <div className="space-y-2">
              <Label htmlFor="max_deliveries">
                Maximum Deliveries *
                {selectedWeek && existingOverride && existingOverride.max_deliveries !== null && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    overridden
                  </Badge>
                )}
              </Label>
              <Input
                id="max_deliveries"
                type="number"
                min={selectedWeek ? 0 : parcelCount}
                max="100"
                value={formData.max_deliveries}
                onChange={(e) => setFormData({ ...formData, max_deliveries: e.target.value })}
                required
                disabled={saving}
              />
              {!selectedWeek && (
                <p className="text-sm text-gray-500">
                  Current parcels assigned: {parcelCount}. Must be at least {parcelCount}.
                </p>
              )}
            </div>

            {/* Driver Assignment - only show for base template */}
            {!selectedWeek && (
              <div className="space-y-2">
                <Label htmlFor="driver">Assigned Driver</Label>
                <Select
                  value={formData.driver_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, driver_id: value === 'none' ? '' : value })}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No driver assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No driver</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Active Status */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  disabled={saving}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active (accepting deliveries)
                </Label>
                {selectedWeek && existingOverride && existingOverride.is_active !== null && (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                    overridden
                  </Badge>
                )}
              </div>
              {selectedWeek && !formData.is_active && (
                <p className="text-sm text-amber-600">
                  Disabling this slot will prevent customers from booking it for this week.
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {selectedWeek ? 'Override Notes' : 'Notes'}
              </Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                disabled={saving}
                placeholder={selectedWeek ? 'E.g., "Reduced capacity due to holiday"' : ''}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t">
              {selectedWeek ? (
                <>
                  <Button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={saving || deleting}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save for This Week Only'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveBase}
                    disabled={saving || deleting}
                  >
                    Save to Base Template
                  </Button>
                </>
              ) : (
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={saving || deleting}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              )}
              <Link href={backUrl}>
                <Button type="button" variant="outline" disabled={saving || deleting}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
