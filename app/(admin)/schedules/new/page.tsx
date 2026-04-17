'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, Calendar, Info } from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

export default function NewSchedulePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Check if creating from a week view
  const weekParam = searchParams.get('week')
  const selectedWeek = weekParam ? parseISO(weekParam) : null

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([])
  const [periods, setPeriods] = useState<Array<{ id: string; name: string; start_time: string; end_time: string }>>([])
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([])

  // Save mode when creating from week view
  const [saveMode, setSaveMode] = useState<'base' | 'week_only'>('base')

  const [formData, setFormData] = useState({
    region_id: searchParams.get('region') || '',
    day_of_week: searchParams.get('day') || '',
    period_id: searchParams.get('period') || '',
    max_deliveries: '10',
    driver_id: '',
    is_active: true,
    notes: '',
  })

  useEffect(() => {
    async function loadData() {
      const [regionsRes, periodsRes, driversRes] = await Promise.all([
        supabase.from('regions').select('id, name').eq('is_active', true).order('name'),
        supabase.from('delivery_periods').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('drivers').select('id, name').eq('status', 'active').order('name'),
      ])

      if (regionsRes.data) setRegions(regionsRes.data)
      if (periodsRes.data) setPeriods(periodsRes.data)
      if (driversRes.data) setDrivers(driversRes.data)
    }
    loadData()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // When saving for week only, create an inactive base schedule + active override
      const isWeekOnly = selectedWeek && saveMode === 'week_only'

      // First check if a base schedule already exists for this combination
      const { data: existingSchedule } = await supabase
        .from('region_schedules')
        .select('id')
        .eq('region_id', formData.region_id)
        .eq('day_of_week', parseInt(formData.day_of_week))
        .eq('period_id', formData.period_id)
        .single()

      let baseScheduleId: string

      if (existingSchedule) {
        // Base already exists
        if (!isWeekOnly) {
          // User wants to create a base template but one already exists
          setError('A schedule already exists for this region, day, and period combination')
          setLoading(false)
          return
        }
        // Use existing base for the override
        baseScheduleId = existingSchedule.id
      } else {
        // Create new base schedule
        const { data, error: insertError } = await supabase
          .from('region_schedules')
          .insert([{
            region_id: formData.region_id,
            day_of_week: parseInt(formData.day_of_week),
            period_id: formData.period_id,
            max_deliveries: isWeekOnly ? 1 : parseInt(formData.max_deliveries), // 1 for week-only base (inactive anyway)
            driver_id: formData.driver_id || null,
            is_active: isWeekOnly ? false : formData.is_active, // Inactive base for week-only
            notes: isWeekOnly ? 'Base template (inactive - created for weekly override)' : (formData.notes || null),
          }])
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            setError('A schedule already exists for this region, day, and period combination')
          } else {
            setError(insertError.message)
          }
          setLoading(false)
          return
        }

        baseScheduleId = data.id
      }

      // If week-only mode, create an override for the selected week
      if (isWeekOnly) {
        const weekStr = format(selectedWeek, 'yyyy-MM-dd')
        const { error: overrideError } = await supabase
          .from('weekly_schedule_overrides')
          .insert({
            base_schedule_id: baseScheduleId,
            week_start: weekStr,
            max_deliveries: parseInt(formData.max_deliveries),
            is_active: formData.is_active,
            notes: formData.notes || null,
          })

        if (overrideError) {
          // If override failed and we just created the base, delete it
          if (!existingSchedule) {
            await supabase.from('region_schedules').delete().eq('id', baseScheduleId)
          }
          if (overrideError.message.includes('does not exist')) {
            setError('Weekly overrides table not yet created. Please run the migration SQL first.')
          } else if (overrideError.code === '23505') {
            setError('An override already exists for this week. Please edit the existing slot instead.')
          } else {
            setError(overrideError.message)
          }
          setLoading(false)
          return
        }
      }

      // Redirect back to appropriate view
      if (selectedWeek) {
        router.push(`/schedules?week=${format(selectedWeek, 'yyyy-MM-dd')}`)
      } else {
        router.push('/schedules')
      }
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const selectedPeriod = periods.find(p => p.id === formData.period_id)
  const backUrl = selectedWeek ? `/schedules?week=${format(selectedWeek, 'yyyy-MM-dd')}` : '/schedules'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Delivery Schedule</h1>
          <p className="text-gray-600 mt-1">
            Create a new delivery slot for a region
          </p>
        </div>
      </div>

      {/* Week Context Banner */}
      {selectedWeek && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  Creating from Week of {format(selectedWeek, 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Choose how to save this new schedule:
                </p>
                <div className="mt-3 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="saveMode"
                      value="base"
                      checked={saveMode === 'base'}
                      onChange={() => setSaveMode('base')}
                      className="mt-1 h-4 w-4 text-indigo-600"
                    />
                    <div>
                      <span className="font-medium text-amber-900">Save to Base Template</span>
                      <p className="text-sm text-amber-700">
                        Creates a permanent slot that will appear every week
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="saveMode"
                      value="week_only"
                      checked={saveMode === 'week_only'}
                      onChange={() => setSaveMode('week_only')}
                      className="mt-1 h-4 w-4 text-amber-600"
                    />
                    <div>
                      <span className="font-medium text-amber-900">Save for This Week Only</span>
                      <p className="text-sm text-amber-700">
                        Creates slot only for week of {format(selectedWeek, 'MMM d')} (won't appear in other weeks)
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Schedule Information</CardTitle>
          <CardDescription>
            Configure when this region will be serviced
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Select
                value={formData.region_id}
                onValueChange={(value) => setFormData({ ...formData, region_id: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day of Week */}
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week *</Label>
              <Select
                value={formData.day_of_week}
                onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="space-y-2">
              <Label htmlFor="period">Delivery Period *</Label>
              <Select
                value={formData.period_id}
                onValueChange={(value) => setFormData({ ...formData, period_id: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name} ({period.start_time.slice(0, 5)} - {period.end_time.slice(0, 5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPeriod && (
                <p className="text-sm text-gray-500">
                  Time window: {selectedPeriod.start_time.slice(0, 5)} - {selectedPeriod.end_time.slice(0, 5)}
                </p>
              )}
            </div>

            {/* Max Deliveries */}
            <div className="space-y-2">
              <Label htmlFor="max_deliveries">Maximum Deliveries *</Label>
              <Input
                id="max_deliveries"
                type="number"
                min="1"
                max="100"
                value={formData.max_deliveries}
                onChange={(e) => setFormData({ ...formData, max_deliveries: e.target.value })}
                required
                disabled={loading}
              />
              <p className="text-sm text-gray-500">
                Maximum number of parcels that can be delivered in this slot
              </p>
            </div>

            {/* Driver Assignment */}
            <div className="space-y-2">
              <Label htmlFor="driver">Assigned Driver (Optional)</Label>
              <Select
                value={formData.driver_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, driver_id: value === 'none' ? '' : value })}
                disabled={loading}
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
              <p className="text-sm text-gray-500">
                Optionally assign a specific driver to this slot
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                disabled={loading}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active (accepting deliveries)
              </Label>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this schedule..."
                rows={3}
                disabled={loading}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={loading || !formData.region_id || !formData.day_of_week || !formData.period_id}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Schedule'
                )}
              </Button>
              <Link href={backUrl}>
                <Button type="button" variant="outline" disabled={loading}>
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