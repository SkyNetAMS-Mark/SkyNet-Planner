import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Layers, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type PostalCodeRange = {
  id: string
  range_start: string
  range_end: string
  city: string | null
  region_id: string
  country_code: string
  regions: {
    id: string
    name: string
    color: string
  } | null
}

type Overlap = {
  range1: PostalCodeRange
  range2: PostalCodeRange
  overlapStart: string
  overlapEnd: string
  winner: PostalCodeRange
}

function rangesOverlap(r1: PostalCodeRange, r2: PostalCodeRange): boolean {
  // Only compare same country codes
  if (r1.country_code !== r2.country_code) return false

  const start1 = parseInt(r1.range_start)
  const end1 = parseInt(r1.range_end)
  const start2 = parseInt(r2.range_start)
  const end2 = parseInt(r2.range_end)

  // Check if ranges overlap
  return start1 <= end2 && start2 <= end1
}

function getOverlapRange(r1: PostalCodeRange, r2: PostalCodeRange): { start: string; end: string } {
  const start1 = parseInt(r1.range_start)
  const end1 = parseInt(r1.range_end)
  const start2 = parseInt(r2.range_start)
  const end2 = parseInt(r2.range_end)

  return {
    start: Math.max(start1, start2).toString(),
    end: Math.min(end1, end2).toString()
  }
}

function getRangeSize(r: PostalCodeRange): number {
  return parseInt(r.range_end) - parseInt(r.range_start)
}

function determineWinner(r1: PostalCodeRange, r2: PostalCodeRange): PostalCodeRange {
  // Exact matches (single codes) win
  const size1 = getRangeSize(r1)
  const size2 = getRangeSize(r2)

  if (size1 === 0 && size2 !== 0) return r1
  if (size2 === 0 && size1 !== 0) return r2

  // Smaller range wins
  return size1 <= size2 ? r1 : r2
}

export default async function OverlappingRangesPage() {
  const supabase = await createClient()

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

  if (error) {
    console.error('Error fetching postal code ranges:', error)
  }

  const ranges = (postalCodeRanges || []) as PostalCodeRange[]

  // Find all overlapping ranges
  const overlaps: Overlap[] = []

  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const r1 = ranges[i]
      const r2 = ranges[j]

      // Skip if same region
      if (r1.region_id === r2.region_id) continue

      if (rangesOverlap(r1, r2)) {
        const overlap = getOverlapRange(r1, r2)
        overlaps.push({
          range1: r1,
          range2: r2,
          overlapStart: overlap.start,
          overlapEnd: overlap.end,
          winner: determineWinner(r1, r2)
        })
      }
    }
  }

  // Sort by overlap start
  overlaps.sort((a, b) => parseInt(a.overlapStart) - parseInt(b.overlapStart))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/postal-codes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Overlapping Ranges</h1>
            <p className="text-gray-600 mt-1">
              View postal code ranges that overlap and their priority resolution
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ranges</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ranges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overlapping Pairs</CardTitle>
            <Layers className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overlaps.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Layers className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How Overlap Priority Works</p>
              <p>
                When postal code ranges overlap, the system automatically assigns parcels to the <strong>most specific range</strong>:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Single postal codes (e.g., 1001-1001) always win</li>
                <li>Smaller ranges take precedence over larger ranges</li>
                <li>This allows you to create exceptions within broader ranges</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overlapping Ranges */}
      <Card>
        <CardHeader>
          <CardTitle>Overlapping Range Pairs</CardTitle>
          <CardDescription>
            {overlaps.length === 0
              ? 'No overlapping ranges found - all postal codes map to exactly one region'
              : `Found ${overlaps.length} overlapping range pair(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overlaps.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No Overlaps</h3>
              <p className="mt-1 text-sm text-gray-500">
                All postal code ranges are distinct with no overlapping areas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {overlaps.map((overlap, index) => {
                const isWinner1 = overlap.winner.id === overlap.range1.id
                const color1 = overlap.range1.regions?.color || '#6366F1'
                const color2 = overlap.range2.regions?.color || '#6366F1'

                return (
                  <div
                    key={index}
                    className="rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="font-mono">
                        Overlap: {overlap.overlapStart === overlap.overlapEnd
                          ? overlap.overlapStart
                          : `${overlap.overlapStart} - ${overlap.overlapEnd}`}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                      {/* Range 1 */}
                      <div
                        className={`p-3 rounded-lg border-2 ${isWinner1 ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: color1 }}
                          />
                          <span className="font-medium text-sm">{overlap.range1.regions?.name}</span>
                          {isWinner1 && (
                            <Badge className="bg-green-600 text-xs">WINS</Badge>
                          )}
                        </div>
                        <p className="font-mono text-lg">
                          {overlap.range1.range_start === overlap.range1.range_end
                            ? overlap.range1.range_start
                            : `${overlap.range1.range_start} - ${overlap.range1.range_end}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Size: {getRangeSize(overlap.range1) + 1} code(s)
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="flex flex-col items-center">
                        <ArrowRight className="h-5 w-5 text-gray-400" />
                        <span className="text-xs text-gray-400 mt-1">vs</span>
                      </div>

                      {/* Range 2 */}
                      <div
                        className={`p-3 rounded-lg border-2 ${!isWinner1 ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: color2 }}
                          />
                          <span className="font-medium text-sm">{overlap.range2.regions?.name}</span>
                          {!isWinner1 && (
                            <Badge className="bg-green-600 text-xs">WINS</Badge>
                          )}
                        </div>
                        <p className="font-mono text-lg">
                          {overlap.range2.range_start === overlap.range2.range_end
                            ? overlap.range2.range_start
                            : `${overlap.range2.range_start} - ${overlap.range2.range_end}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Size: {getRangeSize(overlap.range2) + 1} code(s)
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mt-3">
                      Postal codes <strong>{overlap.overlapStart === overlap.overlapEnd ? overlap.overlapStart : `${overlap.overlapStart}-${overlap.overlapEnd}`}</strong> will be assigned to <strong style={{ color: overlap.winner.regions?.color }}>{overlap.winner.regions?.name}</strong> because it has the smaller range.
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
