'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2 } from 'lucide-react'
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

export default function NewRoutePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    is_active: true,
    lead_time_days: 0,
    route_number: '' as string | number,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!formData.route_number) {
      setError('Route number is required')
      setLoading(false)
      return
    }

    try {
      const routeNum = parseInt(String(formData.route_number))
      const routeName = formData.name || (routeNum === 0 ? 'Unassigned' : `Route ${routeNum}`)

      // Check if a route with this name already exists
      const { data: existingRoute } = await supabase
        .from('regions')
        .select('id')
        .eq('name', routeName)
        .single()

      if (existingRoute) {
        setError('A route with this number already exists')
        setLoading(false)
        return
      }

      const { data, error: insertError } = await supabase
        .from('regions')
        .insert([{
          name: routeName,
          description: formData.description || null,
          color: formData.color,
          is_active: formData.is_active,
          lead_time_days: formData.lead_time_days,
        }])
        .select()

      if (insertError) {
        if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
          setError('A route with this number already exists')
        } else {
          setError(insertError.message)
        }
        setLoading(false)
        return
      }

      router.push('/routes')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/routes">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Route</h1>
          <p className="text-gray-600 mt-1">
            Create a new delivery route
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Route Information</CardTitle>
          <CardDescription>
            Enter the details for the new route
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
                value={formData.route_number}
                onChange={(e) => setFormData({ ...formData, route_number: e.target.value })}
                placeholder="304"
                required
                disabled={loading}
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
                placeholder="Amsterdam Noord (optional)"
                disabled={loading}
              />
              <p className="text-xs text-gray-500">
                Optional friendly name. If empty, will use "Route [number]"
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Covers northern Amsterdam area"
                disabled={loading}
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
                  disabled={loading}
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
                    disabled={loading}
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
                  disabled={loading}
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
                disabled={loading}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active route (can receive deliveries)
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Route'
                )}
              </Button>
              <Link href="/routes">
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
