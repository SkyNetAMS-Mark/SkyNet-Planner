'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Calendar, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { format, startOfWeek, addWeeks, addDays, isSameWeek, getISOWeek } from 'date-fns'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type Schedule = {
  id: string
  region_id: string
  day_of_week: number
  period_id: string
  max_deliveries: number
  driver_id: string | null
  is_active: boolean
  notes: string | null
  regions: { id: string; name: string; color: string } | null
  delivery_periods: { id: string; name: string; start_time: string; end_time: string } | null
  drivers: { id: string; name: string } | null
}

type WeeklyOverride = {
  id: string
  base_schedule_id: string
  week_start: string
  max_deliveries: number | null
  is_active: boolean | null
  notes: string | null
}

type Region = {
  id: string
  name: string
  color: string
}

type Period = {
  id: string
  name: string
  start_time: string
  end_time: string
  sort_order: number
  is_active: boolean
}

type PostalCodeRange = {
  id: string
  region_id: string
  range_start: string
  range_end: string
}

// Helper to extract route number from region name
function extractRouteNumber(name: string): number | null {
  if (name === 'Unassigned') return 0
  const match = name.match(/Route\s+(\d+)/i)
  return match ? parseInt(match[1]) : null
}

export default function SchedulesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [overrides, setOverrides] = useState<WeeklyOverride[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [postalCodeRanges, setPostalCodeRanges] = useState<PostalCodeRange[]>([])

  // Week selection state
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null) // null = base template
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

  // Edit dialog state - extends Schedule with effective values
  type EditingSchedule = Schedule & {
    effectiveMaxDeliveries: number
    effectiveIsActive: boolean
    isOverridden: boolean
    hideInWeekView: boolean
    override?: WeeklyOverride
  }
  const [editingSchedule, setEditingSchedule] = useState<EditingSchedule | null>(null)
  const [editMaxDeliveries, setEditMaxDeliveries] = useState<number>(0)
  const [editIsActive, setEditIsActive] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)

  // Create new schedule dialog state
  type NewScheduleInfo = {
    regionId: string
    regionName: string
    dayOfWeek: number
    periodId: string
    periodName: string
  }
  const [creatingSchedule, setCreatingSchedule] = useState<NewScheduleInfo | null>(null)
  const [newMaxDeliveries, setNewMaxDeliveries] = useState<number>(15)
  const [newIsActive, setNewIsActive] = useState<boolean>(true)

  // Format week for display
  const formatWeekLabel = (weekStart: Date) => {
    const weekEnd = addWeeks(weekStart, 1)
    weekEnd.setDate(weekEnd.getDate() - 1) // Get Sunday
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
  }

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)

    // Fetch base schedules
    const { data: schedulesData } = await supabase
      .from('region_schedules')
      .select(`
        *,
        regions (id, name, color),
        delivery_periods (id, name, start_time, end_time),
        drivers (id, name)
      `)
      .order('day_of_week', { ascending: true })

    // Fetch weekly overrides for selected week
    let overridesData: WeeklyOverride[] = []
    if (selectedWeek) {
      const weekStr = format(selectedWeek, 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('weekly_schedule_overrides')
        .select('*')
        .eq('week_start', weekStr)

      // Table might not exist yet - that's okay
      if (!error) {
        overridesData = (data || []) as WeeklyOverride[]
      }
    }

    // Fetch regions
    const { data: regionsData } = await supabase
      .from('regions')
      .select('id, name, color')
      .eq('is_active', true)

    // Fetch periods
    const { data: periodsData } = await supabase
      .from('delivery_periods')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')

    // Fetch postal code ranges
    const { data: rangesData } = await supabase
      .from('postal_code_ranges')
      .select('id, region_id, range_start, range_end')
      .order('range_start')

    setSchedules((schedulesData || []) as Schedule[])
    setOverrides(overridesData)
    setRegions((regionsData || []) as Region[])
    setPeriods((periodsData || []) as Period[])
    setPostalCodeRanges((rangesData || []) as PostalCodeRange[])
    setLoading(false)
  }, [supabase, selectedWeek])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Open edit dialog
  const openEditDialog = (schedule: ReturnType<typeof getEffectiveSchedule>) => {
    setEditingSchedule(schedule as EditingSchedule)
    setEditMaxDeliveries(schedule.effectiveMaxDeliveries)
    setEditIsActive(schedule.effectiveIsActive)
  }

  // Close edit dialog
  const closeEditDialog = () => {
    setEditingSchedule(null)
    setEditMaxDeliveries(0)
    setEditIsActive(true)
  }

  // Save schedule changes
  const saveScheduleChanges = async (saveToBaseTemplate: boolean) => {
    if (!editingSchedule) return

    setSaving(true)
    try {
      if (selectedWeek && !saveToBaseTemplate) {
        // Save as weekly override
        const weekStr = format(selectedWeek, 'yyyy-MM-dd')

        if (editingSchedule.override) {
          // Update existing override
          await supabase
            .from('weekly_schedule_overrides')
            .update({
              max_deliveries: editMaxDeliveries,
              is_active: editIsActive,
            })
            .eq('id', editingSchedule.override.id)
        } else {
          // Create new override
          await supabase
            .from('weekly_schedule_overrides')
            .insert({
              base_schedule_id: editingSchedule.id,
              week_start: weekStr,
              max_deliveries: editMaxDeliveries,
              is_active: editIsActive,
            })
        }
      } else {
        // Save to base template
        await supabase
          .from('region_schedules')
          .update({
            max_deliveries: editMaxDeliveries,
            is_active: editIsActive,
          })
          .eq('id', editingSchedule.id)
      }

      closeEditDialog()
      loadData() // Refresh data
    } catch (error) {
      console.error('Error saving schedule:', error)
    } finally {
      setSaving(false)
    }
  }

  // Delete weekly override
  const deleteOverride = async () => {
    if (!editingSchedule?.override) return

    setSaving(true)
    try {
      await supabase
        .from('weekly_schedule_overrides')
        .delete()
        .eq('id', editingSchedule.override.id)

      closeEditDialog()
      loadData()
    } catch (error) {
      console.error('Error deleting override:', error)
    } finally {
      setSaving(false)
    }
  }

  // Open create dialog for new schedule
  const openCreateDialog = (regionId: string, regionName: string, dayOfWeek: number, periodId: string, periodName: string) => {
    setCreatingSchedule({ regionId, regionName, dayOfWeek, periodId, periodName })
    setNewMaxDeliveries(15)
    setNewIsActive(true)
  }

  // Close create dialog
  const closeCreateDialog = () => {
    setCreatingSchedule(null)
    setNewMaxDeliveries(15)
    setNewIsActive(true)
  }

  // Save new schedule
  const saveNewSchedule = async () => {
    if (!creatingSchedule) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('region_schedules')
        .insert({
          region_id: creatingSchedule.regionId,
          day_of_week: creatingSchedule.dayOfWeek,
          period_id: creatingSchedule.periodId,
          max_deliveries: newMaxDeliveries,
          is_active: newIsActive,
        })

      if (error) {
        console.error('Error creating schedule:', error)
        return
      }

      closeCreateDialog()
      loadData()
    } catch (error) {
      console.error('Error creating schedule:', error)
    } finally {
      setSaving(false)
    }
  }

  // Get effective schedule value (override or base)
  const getEffectiveSchedule = (schedule: Schedule) => {
    if (!selectedWeek) {
      // Base template view - return as-is
      return {
        ...schedule,
        isOverridden: false,
        effectiveMaxDeliveries: schedule.max_deliveries,
        effectiveIsActive: schedule.is_active,
        hideInWeekView: false,
      }
    }

    // Find override for this schedule
    const override = overrides.find(o => o.base_schedule_id === schedule.id)

    // If base is inactive and no override exists, hide in week view
    // (This is a "week only" slot that doesn't apply to this week)
    const hideInWeekView = !schedule.is_active && !override

    return {
      ...schedule,
      isOverridden: override !== undefined,
      override,
      effectiveMaxDeliveries: override?.max_deliveries ?? schedule.max_deliveries,
      effectiveIsActive: override?.is_active ?? schedule.is_active,
      hideInWeekView,
    }
  }

  // Add postal code ranges to regions and sort by route number
  const regionsWithRanges = regions
    .map(region => {
      const regionRanges = postalCodeRanges.filter(r => r.region_id === region.id)
      const routeNumber = extractRouteNumber(region.name)

      const rangeDisplay = regionRanges.length > 0
        ? regionRanges
            .slice(0, 3)
            .map(r => r.range_start === r.range_end ? r.range_start : `${r.range_start}-${r.range_end}`)
            .join(', ') + (regionRanges.length > 3 ? ` +${regionRanges.length - 3} more` : '')
        : ''

      return {
        ...region,
        postalCodeRanges: regionRanges,
        rangeDisplay,
        routeNumber
      }
    })
    .sort((a, b) => {
      // Put "Unassigned" at the end
      if (a.name === 'Unassigned') return 1
      if (b.name === 'Unassigned') return -1
      // Sort by route number
      const numA = a.routeNumber ?? Infinity
      const numB = b.routeNumber ?? Infinity
      return numA - numB
    })

  // Create schedule matrix
  const scheduleMatrix = regionsWithRanges.map(region => ({
    region,
    slots: DAYS.map((day, dayIndex) => ({
      day,
      dayOfWeek: dayIndex + 1,
      periods: periods.map(period => {
        const schedule = schedules.find(
          s => s.region_id === region.id &&
               s.day_of_week === dayIndex + 1 &&
               s.period_id === period.id
        )
        return {
          period,
          schedule: schedule ? getEffectiveSchedule(schedule) : null,
        }
      })
    }))
  }))

  // Week tabs
  const weeks = [
    null, // Base template
    currentWeekStart,
    addWeeks(currentWeekStart, 1),
    addWeeks(currentWeekStart, 2),
    addWeeks(currentWeekStart, 3),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Delivery Schedules</h1>
          <p className="text-gray-600 mt-1">
            Configure when routes are serviced and capacity limits
          </p>
        </div>
        <Link href="/schedules/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Schedule
          </Button>
        </Link>
      </div>

      {/* Week Selector Tabs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-sm font-medium text-gray-700 mr-2">View:</span>

            {/* Base Template Tab */}
            <Button
              variant={selectedWeek === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedWeek(null)}
              className={selectedWeek === null ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            >
              Base Template
            </Button>

            <div className="h-6 w-px bg-gray-300 mx-2" />

            {/* Week Tabs */}
            {weeks.slice(1).map((week, index) => {
              const isSelected = selectedWeek && week && isSameWeek(selectedWeek, week, { weekStartsOn: 1 })
              const isCurrent = week && isSameWeek(week, currentWeekStart, { weekStartsOn: 1 })

              return (
                <Button
                  key={index}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedWeek(week)}
                  className={`relative ${isSelected ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                >
                  {isCurrent && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500" />
                  )}
                  Week {week ? getISOWeek(week) : ''}
                  <span className="text-xs ml-1 opacity-70">
                    ({week ? format(week, 'MMM d') : ''})
                  </span>
                </Button>
              )
            })}
          </div>

          {/* Week Info */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {selectedWeek === null ? (
                <span>
                  <strong>Base Template</strong> - Default schedule configuration used when no weekly override exists
                </span>
              ) : (
                <span>
                  <strong>Week of {formatWeekLabel(selectedWeek)}</strong>
                  {isSameWeek(selectedWeek, currentWeekStart, { weekStartsOn: 1 })
                    ? ' (Current week)'
                    : ''}
                </span>
              )}
            </div>
            {selectedWeek && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {overrides.length} override{overrides.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Slots</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter(s => !getEffectiveSchedule(s).hideInWeekView).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Slots</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter(s => {
                const eff = getEffectiveSchedule(s)
                return !eff.hideInWeekView && eff.effectiveIsActive
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <Calendar className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.reduce((sum, s) => {
                const eff = getEffectiveSchedule(s)
                if (eff.hideInWeekView) return sum
                return sum + (eff.effectiveIsActive ? eff.effectiveMaxDeliveries : 0)
              }, 0)}
            </div>
            <p className="text-xs text-muted-foreground">deliveries/week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Routes</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedWeek === null ? 'Base Schedule Template' : `Schedule for Week of ${format(selectedWeek, 'MMM d, yyyy')}`}
          </CardTitle>
          <CardDescription>
            {selectedWeek === null
              ? 'Default delivery slots - these apply when no weekly override exists'
              : 'Yellow cells indicate overrides from the base template'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {regions.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No routes configured</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create routes first before setting up delivery schedules.
              </p>
              <div className="mt-6">
                <Link href="/routes/new">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Route
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {scheduleMatrix.map(({ region, slots }) => (
                <div key={region.id} className="space-y-3">
                  {/* Region Header */}
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: region.color + '20' }}
                    >
                      <span
                        className="text-xs font-bold"
                        style={{ color: region.color }}
                      >
                        {region.routeNumber ?? '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{region.name}</h3>
                      {region.rangeDisplay && (
                        <p className="text-sm text-gray-600">
                          Postal codes: {region.rangeDisplay}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Schedule Grid */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium text-gray-700">Day</th>
                          {periods.map(period => (
                            <th key={period.id} className="text-center p-2 font-medium text-gray-700">
                              {period.name}
                              <div className="text-xs font-normal text-gray-500">
                                {period.start_time.slice(0, 5)} - {period.end_time.slice(0, 5)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map(({ day, dayOfWeek, periods: dayPeriods }) => {
                          // Calculate actual date for this day if viewing a specific week
                          const dayDate = selectedWeek ? addDays(selectedWeek, dayOfWeek - 1) : null

                          return (
                          <tr key={dayOfWeek} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium text-gray-900">
                              {day}
                              {dayDate && (
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                  {format(dayDate, 'MMM d')}
                                </span>
                              )}
                            </td>
                            {dayPeriods.map(({ period, schedule }) => (
                              <td key={period.id} className="p-2 text-center">
                                {schedule && !schedule.hideInWeekView ? (
                                  <div
                                    onClick={() => openEditDialog(schedule)}
                                    className="inline-block"
                                  >
                                    <div
                                      className={`rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                                        schedule.isOverridden
                                          ? 'bg-amber-50 hover:bg-amber-100 border-2 border-amber-300'
                                          : schedule.effectiveIsActive
                                            ? 'bg-green-50 hover:bg-green-100 border border-green-200'
                                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                      }`}
                                    >
                                      <div className={`font-semibold text-sm ${!schedule.effectiveIsActive ? 'line-through text-gray-400' : ''}`}>
                                        {schedule.effectiveMaxDeliveries}
                                      </div>
                                      {schedule.isOverridden && (
                                        <div className="text-xs text-amber-600 mt-0.5">
                                          modified
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    onClick={() => openCreateDialog(region.id, region.name, dayOfWeek, period.id, period.name)}
                                    className="inline-block rounded-lg px-3 py-2 border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors"
                                  >
                                    <span className="text-gray-400 text-xs">+</span>
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        )})}

                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-16 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
                <span className="font-semibold text-sm">15</span>
              </div>
              <div className="text-sm">
                <div className="font-medium">Active Slot</div>
                <div className="text-gray-600">Number = max deliveries</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-16 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                <span className="font-semibold text-sm line-through text-gray-400">10</span>
              </div>
              <div className="text-sm">
                <div className="font-medium">Inactive Slot</div>
                <div className="text-gray-600">Not accepting deliveries</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-16 rounded-lg bg-amber-50 border-2 border-amber-300 flex flex-col items-center justify-center">
                <span className="font-semibold text-sm">12</span>
                <span className="text-xs text-amber-600">modified</span>
              </div>
              <div className="text-sm">
                <div className="font-medium">Weekly Override</div>
                <div className="text-gray-600">Modified from base</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                <span className="text-gray-400 text-xs">+</span>
              </div>
              <div className="text-sm">
                <div className="font-medium">No Slot</div>
                <div className="text-gray-600">Click to create</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Schedule Dialog */}
      <Dialog open={editingSchedule !== null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Edit Schedule
              {editingSchedule?.regions?.name && (
                <span className="text-gray-500 font-normal ml-2">
                  - {editingSchedule.regions.name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule && (
                <>
                  {DAYS[editingSchedule.day_of_week - 1]} • {editingSchedule.delivery_periods?.name}
                  {editingSchedule.delivery_periods && (
                    <span className="ml-1">
                      ({editingSchedule.delivery_periods.start_time.slice(0, 5)} - {editingSchedule.delivery_periods.end_time.slice(0, 5)})
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="max-deliveries" className="text-right">
                Max Deliveries
              </Label>
              <Input
                id="max-deliveries"
                type="number"
                min="0"
                value={editMaxDeliveries}
                onChange={(e) => setEditMaxDeliveries(parseInt(e.target.value) || 0)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Active</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant={editIsActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditIsActive(true)}
                  className={editIsActive ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!editIsActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditIsActive(false)}
                  className={!editIsActive ? "bg-gray-600 hover:bg-gray-700" : ""}
                >
                  No
                </Button>
              </div>
            </div>

            {editingSchedule?.isOverridden && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <p className="text-amber-800">
                  This slot has a weekly override. Base template value: <strong>{editingSchedule.max_deliveries}</strong>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedWeek ? (
              // Week view - show save options
              <>
                {editingSchedule?.isOverridden && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={deleteOverride}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove Override
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => saveScheduleChanges(false)}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save for This Week
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveScheduleChanges(true)}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save to Base
                  </Button>
                </div>
              </>
            ) : (
              // Base template view - just save
              <Button
                type="button"
                onClick={() => saveScheduleChanges(true)}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Schedule Dialog */}
      <Dialog open={creatingSchedule !== null} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Add Schedule Slot
              {creatingSchedule && (
                <span className="text-gray-500 font-normal ml-2">
                  - {creatingSchedule.regionName}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {creatingSchedule && (
                <>
                  {DAYS[creatingSchedule.dayOfWeek - 1]} • {creatingSchedule.periodName}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-max-deliveries" className="text-right">
                Max Deliveries
              </Label>
              <Input
                id="new-max-deliveries"
                type="number"
                min="0"
                value={newMaxDeliveries}
                onChange={(e) => setNewMaxDeliveries(parseInt(e.target.value) || 0)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Active</Label>
              <div className="col-span-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant={newIsActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewIsActive(true)}
                  className={newIsActive ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!newIsActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewIsActive(false)}
                  className={!newIsActive ? "bg-gray-600 hover:bg-gray-700" : ""}
                >
                  No
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeCreateDialog}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveNewSchedule}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
