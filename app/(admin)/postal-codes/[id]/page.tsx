'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function EditPostalCodeRangePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const rangeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState({
    range_start: '',
    range_end: '',
    region_id: '',
    country_code: 'BE',
    city: '',
  })

  useEffect(() => {
    async function loadData() {
      // Load postal code range
      const { data: range, error: rangeError } = await supabase
        .from('postal_code_ranges')
        .select('*')
        .eq('id', rangeId)
        .single()

      if (rangeError || !range) {
        setError('Postal code range not found')
        setLoading(false)
        return
      }

      setFormData({
        range_start: range.range_start,
        range_end: range.range_end,
        region_id: range.region_id,
        country_code: range.country_code,
        city: range.city || '',
      })

      // Load regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (regionsData) {
        setRegions(regionsData)
      }

      setLoading(false)
    }

    loadData()
  }, [rangeId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Validate for Belgian codes
    if (formData.country_code === 'BE') {
      const start = parseInt(formData.range_start)
      const end = parseInt(formData.range_end)
      
      if (isNaN(start) || isNaN(end)) {
        setError('Belgian postal codes must be numeric')
        setSaving(false)
        return
      }
      
      if (start < 1000 || end > 9999) {
        setError('Belgian postal codes must be between 1000-9999')
        setSaving(false)
        return
      }
      
      if (start > end) {
        setError('Start code must be less than or equal to end code')
        setSaving(false)
        return
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('postal_code_ranges')
        .update({
          range_start: formData.range_start,
          range_end: formData.range_end,
          region_id: formData.region_id,
          country_code: formData.country_code,
          city: formData.city || null,
        })
        .eq('id', rangeId)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      toast.success('Postal code range updated successfully')
      router.push('/postal-codes')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this postal code range? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const { error: deleteError } = await supabase
        .from('postal_code_ranges')
        .delete()
        .eq('id', rangeId)

      if (deleteError) {
        setError(deleteError.message)
        setDeleting(false)
        return
      }

      toast.success('Postal code range deleted successfully')
      router.push('/postal-codes')
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
          <Link href="/postal-codes">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Postal Code Range</h1>
            <p className="text-gray-600 mt-1">
              Update postal code range information
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting || saving}
        >
          {deleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Range
            </>
          )}
        </Button>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Postal Code Range Information</CardTitle>
          <CardDescription>
            Update the details for this postal code range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Country */}
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Select
                value={formData.country_code}
                onValueChange={(value) => setFormData({ ...formData, country_code: value })}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BE">Belgium</SelectItem>
                  <SelectItem value="NL">Netherlands</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Range Start */}
            <div className="space-y-2">
              <Label htmlFor="start">Start Code *</Label>
              <Input
                id="start"
                value={formData.range_start}
                onChange={(e) => setFormData({ ...formData, range_start: e.target.value.toUpperCase() })}
                placeholder={formData.country_code === 'BE' ? '1000' : '1181AB'}
                required
                disabled={saving}
              />
            </div>

            {/* Range End */}
            <div className="space-y-2">
              <Label htmlFor="end">End Code *</Label>
              <Input
                id="end"
                value={formData.range_end}
                onChange={(e) => setFormData({ ...formData, range_end: e.target.value.toUpperCase() })}
                placeholder={formData.country_code === 'BE' ? '1299' : '1200CD'}
                required
                disabled={saving}
              />
              <p className="text-sm text-gray-500">
                For single code, use same value as start
              </p>
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Select
                value={formData.region_id}
                onValueChange={(value) => setFormData({ ...formData, region_id: value })}
                disabled={saving}
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

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city">City Name</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                disabled={saving}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={saving || deleting || !formData.region_id}
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
              <Link href="/postal-codes">
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