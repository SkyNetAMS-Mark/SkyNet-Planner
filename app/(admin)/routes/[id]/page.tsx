'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Green', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
]

export default function EditRoutePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const routeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postalCodeCount, setPostalCodeCount] = useState(0)
  const [postalCodeRanges, setPostalCodeRanges] = useState<any[]>([])
  const [parcelCount, setParcelCount] = useState(0)
  const [scheduleCount, setScheduleCount] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    is_active: true,
    lead_time_days: 0,
    route_number: null as number | null,
  })
  const [displayRouteNumber, setDisplayRouteNumber] = useState<number | null>(null)

  // Helper function to extract route number from name (e.g., "Route 304" -> 304)
  const extractRouteNumber = (name: string): number | null => {
    const match = name.match(/Route\s+(\d+)/i)
    return match ? parseInt(match[1]) : null
  }

  useEffect(() => {
    async function loadRoute() {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('id', routeId)
        .single()

      if (error || !data) {
        setError('Route not found')
        setLoading(false)
        return
      }

      const typedData = data as any

      // Extract route number from name if not stored in column
      const routeNum = typedData.route_number || extractRouteNumber(typedData.name)
      setDisplayRouteNumber(routeNum)

      setFormData({
        name: typedData.name,
        description: typedData.description || '',
        color: typedData.color,
        is_active: typedData.is_active,
        lead_time_days: typedData.lead_time_days || 0,
        route_number: routeNum,
      })

      // Get postal code ranges for this route
      const { data: ranges } = await supabase
        .from('postal_code_ranges')
        .select('*')
        .eq('region_id', routeId)
        .order('range_start')

      setPostalCodeCount(ranges?.length || 0)
      setPostalCodeRanges(ranges || [])

      // Check for parcels using this route
      const { count: parcels } = await supabase
        .from('parcels')
        .select('*', { count: 'exact', head: true })
        .eq('region_id', routeId)

      setParcelCount(parcels || 0)

      // Check for schedules using this route
      const { count: schedules } = await supabase
        .from('region_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('region_id', routeId)

      setScheduleCount(schedules || 0)

      setLoading(false)
    }

    loadRoute()
  }, [routeId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Update name to include route number if changed
      let nameToSave = formData.name
      if (formData.route_number && !formData.name.includes('Route')) {
        nameToSave = formData.route_number === 0 ? 'Unassigned' : `Route ${formData.route_number}`
      }

      const updateData: any = {
        name: nameToSave,
        description: formData.description || null,
        color: formData.color,
        is_active: formData.is_active,
        lead_time_days: formData.lead_time_days,
      }

      // Try to include route_number if the column exists (will fail gracefully if not)
      // For now, we store the route number in the name
      const { error: updateError } = await supabase
        .from('regions')
        .update(updateData)
        .eq('id', routeId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      router.push('/routes')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (postalCodeCount > 0) {
      setError('Cannot delete route with assigned postal codes. Please reassign them first.')
      return
    }

    if (parcelCount > 0) {
      setError(`Cannot delete route with ${parcelCount} parcel(s). Please reassign or delete the parcels first.`)
      return
    }

    if (scheduleCount > 0) {
      setError(`Cannot delete route with ${scheduleCount} schedule(s). Please delete the schedules first.`)
      return
    }

    if (!confirm('Are you sure you want to delete this route? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('regions')
        .delete()
        .eq('id', routeId)

      if (deleteError) {
        setError(deleteError.message)
        setDeleting(false)
        return
      }

      router.push('/routes')
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/routes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Edit Route {displayRouteNumber || ''}
            </h1>
            <p className="text-gray-600 mt-1">
              Update route information
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting || saving || postalCodeCount > 0 || parcelCount > 0 || scheduleCount > 0}
        >
          {deleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Route
            </>
          )}
        </Button>
      </div>

      {/* Info Alerts */}
      {(postalCodeCount > 0 || parcelCount > 0 || scheduleCount > 0) && (
        <div className="space-y-2">
          {postalCodeCount > 0 && (
            <Alert>
              <AlertDescription>
                This route has {postalCodeCount} postal code range(s) assigned.
                You must reassign them before deleting this route.
              </AlertDescription>
            </Alert>
          )}
          {parcelCount > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                This route has {parcelCount} parcel(s) assigned.
                You must reassign or delete the parcels before deleting this route.
              </AlertDescription>
            </Alert>
          )}
          {scheduleCount > 0 && (
            <Alert>
              <AlertDescription>
                This route has {scheduleCount} delivery schedule(s).
                You must delete the schedules before deleting this route.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Route Information</CardTitle>
          <CardDescription>
            Update the details for this route
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Route Number */}
            <div className="space-y-2">
              <Label htmlFor="route_number">Route Number *</Label>
              <Input
                id="route_number"
                type="number"
                value={formData.route_number || ''}
                onChange={(e) => setFormData({ ...formData, route_number: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="304"
                required
                disabled={saving}
                className="w-32"
              />
              <p className="text-xs text-gray-500">
                The route number used by drivers (e.g., 304, 305)
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Amsterdam Noord"
                disabled={saving}
              />
              <p className="text-xs text-gray-500">
                Optional friendly name for the route
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={saving}
              />
            </div>

            {/* Lead Time */}
            <div className="space-y-2">
              <Label htmlFor="lead_time_days">Lead Time (extra days)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="lead_time_days"
                  type="number"
                  min="0"
                  max="7"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                  disabled={saving}
                  className="w-24"
                />
                <span className="text-sm text-gray-600">
                  {formData.lead_time_days === 0
                    ? 'Standard delivery (no extra days)'
                    : `+${formData.lead_time_days} day${formData.lead_time_days > 1 ? 's' : ''} before earliest delivery slot`}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Use this for remote areas like islands (Texel, Ameland) that need extra time for delivery.
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Route Color</Label>
              <div className="grid grid-cols-4 gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`flex items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                      formData.color === color.value
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    disabled={saving}
                  >
                    <div
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-sm font-medium">{color.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Label htmlFor="custom-color" className="text-sm">Custom:</Label>
                <input
                  id="custom-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20 rounded border cursor-pointer"
                  disabled={saving}
                />
                <span className="text-sm text-gray-600 font-mono">{formData.color}</span>
              </div>
            </div>

            {/* Status */}
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
                Active route (can receive deliveries)
              </Label>
            </div>

            {/* Postal Code Ranges Info */}
            <div className="rounded-lg bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Postal Code Ranges</p>
                  <p className="text-sm text-gray-600">
                    {postalCodeCount} range(s) assigned to this route
                  </p>
                </div>
                <Link href="/postal-codes">
                  <Button variant="outline" size="sm">
                    Manage Ranges
                  </Button>
                </Link>
              </div>
              {postalCodeRanges.length > 0 && (
                <div className="border-t pt-3">
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {postalCodeRanges.map((range) => (
                      <Link key={range.id} href={`/postal-codes/${range.id}`}>
                        <div className="text-sm p-2 rounded hover:bg-white transition-colors">
                          <span className="font-mono font-semibold">
                            {range.range_start === range.range_end
                              ? range.range_start
                              : `${range.range_start} - ${range.range_end}`}
                          </span>
                          {range.city && (
                            <span className="text-gray-600 ml-2">({range.city})</span>
                          )}
                          <span className="text-xs text-gray-500 ml-2">{range.country_code}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
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
              <Link href="/routes">
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
