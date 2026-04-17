import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Truck, MapPin, Calendar } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch dashboard statistics
  const [
    { count: totalParcels },
    { count: totalDrivers },
    { count: totalRegions },
    { count: pendingParcels },
  ] = await Promise.all([
    supabase.from('parcels').select('*', { count: 'exact', head: true }),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('regions').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('parcels').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const stats = [
    {
      title: 'Total Parcels',
      value: totalParcels || 0,
      description: 'All time parcels',
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active Drivers',
      value: totalDrivers || 0,
      description: 'Currently active',
      icon: Truck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Active Regions',
      value: totalRegions || 0,
      description: 'Delivery regions',
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Pending Parcels',
      value: pendingParcels || 0,
      description: 'Awaiting slot selection',
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your parcel delivery operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/parcels/upload"
              className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Upload Parcels</div>
              <div className="text-sm text-gray-600">
                Bulk upload parcels from CSV
              </div>
            </a>
            <a
              href="/schedules"
              className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Manage Schedules</div>
              <div className="text-sm text-gray-600">
                Configure delivery slots
              </div>
            </a>
            <a
              href="/drivers"
              className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Manage Drivers</div>
              <div className="text-sm text-gray-600">
                Add or update drivers
              </div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Set up your delivery system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div className="font-medium">Database configured</div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <div className="font-medium">Add delivery regions</div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <div className="font-medium">Import postal codes</div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <div className="font-medium">Configure schedules</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}