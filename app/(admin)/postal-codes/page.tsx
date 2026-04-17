import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Mail, Upload, Layers } from 'lucide-react'
import Link from 'next/link'

export default async function PostalCodesPage() {
  const supabase = await createClient()

  // Fetch all postal code ranges with region info
  const { data: postalCodeRanges, error } = await supabase
    .from('postal_code_ranges')
    .select(`
      *,
      regions (
        id,
        name,
        color
      )
    `)
    .order('range_start', { ascending: true })

  // Fetch regions for stats
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name')

  if (error) {
    console.error('Error fetching postal code ranges:', error)
  }

  type PostalCodeRange = {
    id: string
    range_start: string
    range_end: string
    city: string | null
    region_id: string
    country_code: string
    created_at: string
    updated_at: string
    regions: {
      id: string
      name: string
      color: string
    } | null
  }

  type Region = {
    id: string
    name: string
  }

  const typedRanges = (postalCodeRanges || []) as PostalCodeRange[]
  const typedRegions = (regions || []) as Region[]

  // Group ranges by region and sort by lowest postal code
  const rangesByRegion = typedRegions
    .map(region => ({
      region,
      ranges: typedRanges.filter(r => r.region_id === region.id),
      minPostalCode: Math.min(
        ...typedRanges
          .filter(r => r.region_id === region.id)
          .map(r => parseInt(r.range_start))
      )
    }))
    .sort((a, b) => {
      // Sort by minimum postal code (lowest first)
      if (isFinite(a.minPostalCode) && isFinite(b.minPostalCode)) {
        return a.minPostalCode - b.minPostalCode
      }
      // Regions without postal codes go to the end
      if (!isFinite(a.minPostalCode)) return 1
      if (!isFinite(b.minPostalCode)) return -1
      return 0
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Postal Code Ranges</h1>
          <p className="text-gray-600 mt-1">
            Manage postal code ranges for delivery regions
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/postal-codes/overlaps">
            <Button variant="outline">
              <Layers className="mr-2 h-4 w-4" />
              View Overlaps
            </Button>
          </Link>
          <Link href="/postal-codes/import">
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Range
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ranges</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedRanges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Belgium Codes</CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedRanges.filter(r => r.country_code === 'BE').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Netherlands Codes</CardTitle>
            <Mail className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedRanges.filter(r => r.country_code === 'NL').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Postal Code Ranges by Region */}
      <Card>
        <CardHeader>
          <CardTitle>Postal Code Ranges by Region</CardTitle>
          <CardDescription>
            All postal code ranges organized by delivery region
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {rangesByRegion.map(({ region, ranges }) => {
              const regionColor = ranges[0]?.regions?.color || '#6366F1'

              return (
                <Card key={region.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: regionColor + '20' }}
                        >
                          <Mail
                            className="h-5 w-5"
                            style={{ color: regionColor }}
                          />
                        </div>
                        <div>
                          <CardTitle>{region.name}</CardTitle>
                          <CardDescription>{ranges.length} range(s)</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {ranges.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No postal code ranges assigned yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {ranges.map((range) => (
                          <Link key={range.id} href={`/postal-codes/${range.id}`}>
                            <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                              <div>
                                <p className="font-mono font-semibold">
                                  {range.range_start === range.range_end
                                    ? range.range_start
                                    : `${range.range_start} - ${range.range_end}`}
                                </p>
                                {range.city && (
                                  <p className="text-sm text-gray-600">{range.city}</p>
                                )}
                                <p className="text-xs text-gray-500">
                                  {range.country_code}
                                </p>
                              </div>
                              <Button variant="ghost" size="sm">
                                Edit
                              </Button>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Postal Code Ranges</p>
              <p>
                This system uses ranges instead of individual codes for efficiency. 
                A range like "1000-1299" covers all codes from 1000 to 1299. 
                When a parcel arrives with code 1075, it automatically matches this range and gets assigned to the region.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}