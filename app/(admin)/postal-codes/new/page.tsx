'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewPostalCodePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState({
    code: '',
    region_id: '',
    city: '',
  })

  useEffect(() => {
    async function loadRegions() {
      const { data } = await supabase
        .from('regions')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (data) {
        setRegions(data)
      }
    }
    loadRegions()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const code = parseInt(formData.code)
    if (isNaN(code) || code < 1000 || code > 9999) {
      setError('Postal code must be between 1000 and 9999')
      setLoading(false)
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('postal_codes')
        .insert([{
          code,
          region_id: formData.region_id,
          city: formData.city || null,
        }])
        .select()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('This postal code already exists')
        } else {
          setError(insertError.message)
        }
        setLoading(false)
        return
      }

      router.push('/postal-codes')
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
        <Link href="/postal-codes">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Postal Code</h1>
          <p className="text-gray-600 mt-1">
            Add a single postal code manually
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Postal Code Information</CardTitle>
          <CardDescription>
            Enter the details for the new postal code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Postal Code */}
            <div className="space-y-2">
              <Label htmlFor="code">Postal Code *</Label>
              <Input
                id="code"
                type="number"
                min="1000"
                max="9999"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="1000"
                required
                disabled={loading}
              />
              <p className="text-sm text-gray-500">
                Belgian postal code (1000-9999)
              </p>
            </div>

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
              <p className="text-sm text-gray-500">
                The delivery region for this postal code
              </p>
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city">City Name</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Brussels"
                disabled={loading}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={loading || !formData.region_id}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Postal Code'
                )}
              </Button>
              <Link href="/postal-codes">
                <Button type="button" variant="outline" disabled={loading}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tip */}
      <Card className="max-w-2xl bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> For importing multiple postal codes at once, use the{' '}
            <Link href="/postal-codes/import" className="underline font-medium">
              Bulk Import
            </Link>{' '}
            feature.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}