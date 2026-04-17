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
import { ArrowLeft, Loader2, Upload } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ImportPostalCodesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [cityName, setCityName] = useState('')
  const [countryCode, setCountryCode] = useState('BE')

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

  const handleAddRange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    // Validate inputs
    if (!rangeStart || !rangeEnd) {
      setError('Please enter both start and end of the range')
      setLoading(false)
      return
    }

    // For Belgian codes, validate numeric range
    if (countryCode === 'BE') {
      const start = parseInt(rangeStart)
      const end = parseInt(rangeEnd)
      
      if (isNaN(start) || isNaN(end)) {
        setError('Belgian postal codes must be numeric')
        setLoading(false)
        return
      }
      
      if (start < 1000 || end > 9999) {
        setError('Belgian postal codes must be between 1000-9999')
        setLoading(false)
        return
      }
      
      if (start > end) {
        setError('Start code must be less than or equal to end code')
        setLoading(false)
        return
      }
    }

    try {
      // Insert the range
      const { error: insertError } = await supabase
        .from('postal_code_ranges')
        .insert([{
          range_start: rangeStart,
          range_end: rangeEnd,
          region_id: selectedRegion,
          country_code: countryCode,
          city: cityName || null,
        }])

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      const rangeSize = countryCode === 'BE' 
        ? parseInt(rangeEnd) - parseInt(rangeStart) + 1
        : 1

      toast.success(`Postal code range added successfully!`)
      setSuccess(`Added range ${rangeStart}-${rangeEnd} (${rangeSize} codes) to ${regions.find(r => r.id === selectedRegion)?.name}`)
      
      // Reset form
      setRangeStart('')
      setRangeEnd('')
      setCityName('')
      setLoading(false)
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
          <h1 className="text-3xl font-bold text-gray-900">Add Postal Code Range</h1>
          <p className="text-gray-600 mt-1">
            Add a postal code or range of postal codes
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Range Form */}
        <Card>
          <CardHeader>
            <CardTitle>Postal Code Range</CardTitle>
            <CardDescription>
              Enter a single code or a range of codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRange} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="bg-green-50 text-green-900 border-green-200">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {/* Country Selection */}
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={countryCode}
                  onValueChange={setCountryCode}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BE">Belgium (1000-9999)</SelectItem>
                    <SelectItem value="NL">Netherlands (1000AA-9999ZZ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Region Selection */}
              <div className="space-y-2">
                <Label htmlFor="region">Region *</Label>
                <Select
                  value={selectedRegion}
                  onValueChange={setSelectedRegion}
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

              {/* Range Start */}
              <div className="space-y-2">
                <Label htmlFor="start">Start Code *</Label>
                <Input
                  id="start"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value.toUpperCase())}
                  placeholder={countryCode === 'BE' ? '1000' : '1181AB'}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  {countryCode === 'BE' ? 'Enter 4-digit number' : 'Enter format like 1181AB'}
                </p>
              </div>

              {/* Range End */}
              <div className="space-y-2">
                <Label htmlFor="end">End Code *</Label>
                <Input
                  id="end"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value.toUpperCase())}
                  placeholder={countryCode === 'BE' ? '1299' : '1200CD'}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  For single code, use same value as start (e.g., 1000-1000)
                </p>
              </div>

              {/* City Name */}
              <div className="space-y-2">
                <Label htmlFor="city">City Name (Optional)</Label>
                <Input
                  id="city"
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  placeholder="Brussels"
                  disabled={loading}
                />
              </div>

              {/* Preview */}
              {rangeStart && rangeEnd && selectedRegion && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Preview</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Range: {rangeStart} - {rangeEnd}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {rangeStart === rangeEnd ? 'Single postal code' : 'Postal code range'}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={loading || !selectedRegion}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Add Postal Code Range
                    </>
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

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Understanding postal code ranges
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Single Postal Code</h4>
              <p className="text-sm text-gray-600">
                To add a single code, use the same value for start and end:
              </p>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded mt-1">
                1000 - 1000
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">Postal Code Range</h4>
              <p className="text-sm text-gray-600">
                To add a range, specify start and end:
              </p>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded mt-1">
                1000 - 1299 (Brussels area)
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">Example Ranges</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Brussels:</span>
                  <span className="font-mono">1000 - 1299</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Antwerp:</span>
                  <span className="font-mono">2000 - 2999</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amsterdam (NL):</span>
                  <span className="font-mono">1000AA - 1109ZZ</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 text-blue-700">How Matching Works</h4>
              <p className="text-sm text-gray-600">
                When a parcel arrives with postal code 1075, the system checks all ranges and finds it matches 1000-1299, automatically assigning it to the Brussels region.
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 text-amber-700">Important</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Ranges can overlap (first match wins)</li>
                <li>More specific ranges should be added first</li>
                <li>Single codes (1000-1000) take priority over ranges</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}