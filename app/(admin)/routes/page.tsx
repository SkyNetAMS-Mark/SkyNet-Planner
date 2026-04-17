import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Route } from 'lucide-react'
import Link from 'next/link'

export default async function RoutesPage() {
  const supabase = await createClient()

  // Fetch all routes (stored in regions table)
  const { data: routes, error } = await supabase
    .from('regions')
    .select('*')
    .order('name', { ascending: true })

  // Fetch postal code ranges
  const { data: postalCodeRanges } = await supabase
    .from('postal_code_ranges')
    .select('id, region_id, range_start, range_end, city, country_code')

  if (error) {
    console.error('Error fetching routes:', error)
  }

  type RouteType = {
    id: string
    name: string
    description: string | null
    color: string
    is_active: boolean
    lead_time_days: number
    created_at: string
    updated_at: string
  }

  type PostalCodeRange = {
    id: string
    region_id: string
    range_start: string
    range_end: string
    city: string | null
    country_code: string
  }

  // Helper function to extract route number from name (e.g., "Route 304" -> 304)
  const extractRouteNumber = (name: string): number | null => {
    if (name === 'Unassigned') return 0
    const match = name.match(/Route\s+(\d+)/i)
    return match ? parseInt(match[1]) : null
  }

  const typedRoutes = (routes || []) as RouteType[]
  const typedRanges = (postalCodeRanges || []) as PostalCodeRange[]

  // Calculate postal code count per route and extract route number
  const routesWithCounts = typedRoutes.map(route => {
    const routeRanges = typedRanges.filter(r => r.region_id === route.id)
    const extractedRouteNumber = extractRouteNumber(route.name)
    return {
      ...route,
      displayRouteNumber: extractedRouteNumber,
      postalCodeCount: routeRanges.length,
      postalCodeRanges: routeRanges,
    }
  })

  // Sort by route number (extracted from name if needed)
  routesWithCounts.sort((a, b) => {
    // Put "Unassigned" (route 0) at the end
    if (a.name === 'Unassigned') return 1
    if (b.name === 'Unassigned') return -1
    // Sort by route number
    const numA = a.displayRouteNumber ?? Infinity
    const numB = b.displayRouteNumber ?? Infinity
    return numA - numB
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Routes</h1>
          <p className="text-gray-600 mt-1">
            Manage delivery routes and their postal code assignments
          </p>
        </div>
        <Link href="/routes/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Routes</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedRoutes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Routes</CardTitle>
            <Route className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedRoutes.filter(r => r.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Postal Code Ranges</CardTitle>
            <Route className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedRanges.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Routes List */}
      <Card>
        <CardHeader>
          <CardTitle>All Routes</CardTitle>
          <CardDescription>
            Delivery routes with postal code assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typedRoutes.length === 0 ? (
            <div className="text-center py-12">
              <Route className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No routes</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by importing routes from your postal code data.
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {routesWithCounts.map((route) => (
                <Link key={route.id} href={`/routes/${route.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: route.color + '20' }}
                          >
                            <span
                              className="text-sm font-bold"
                              style={{ color: route.color }}
                            >
                              {route.displayRouteNumber ?? '?'}
                            </span>
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {route.displayRouteNumber !== null
                                ? `Route ${route.displayRouteNumber}`
                                : route.name}
                            </CardTitle>
                          </div>
                        </div>
                        <Badge
                          variant={route.is_active ? 'default' : 'secondary'}
                          className={
                            route.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : ''
                          }
                        >
                          {route.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {route.description && (
                        <CardDescription className="mt-2">
                          {route.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Postal Code Ranges</span>
                          <span className="font-semibold">
                            {route.postalCodeCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Lead Time</span>
                          <span className="font-semibold">
                            {route.lead_time_days > 0
                              ? `+${route.lead_time_days} day${route.lead_time_days > 1 ? 's' : ''}`
                              : 'Standard'}
                          </span>
                        </div>
                        {route.postalCodeRanges.length > 0 && (
                          <div className="text-xs text-gray-500 space-y-1 mt-2 pt-2 border-t">
                            {route.postalCodeRanges.slice(0, 3).map((range) => (
                              <div key={range.id} className="font-mono">
                                {range.range_start === range.range_end
                                  ? range.range_start
                                  : `${range.range_start}-${range.range_end}`}
                                {range.city && ` (${range.city})`}
                              </div>
                            ))}
                            {route.postalCodeRanges.length > 3 && (
                              <div className="text-gray-400">
                                +{route.postalCodeRanges.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
