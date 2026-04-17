import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Truck } from 'lucide-react'
import Link from 'next/link'

export default async function DriversPage() {
  const supabase = await createClient()

  // Fetch all drivers
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching drivers:', error)
  }

  // Type assertion for drivers
  type Driver = {
    id: string
    name: string
    email: string
    phone: string
    vehicle_type: 'owned' | 'external'
    vehicle_registration: string | null
    status: 'active' | 'inactive'
    notes: string | null
    created_at: string
    updated_at: string
  }

  const typedDrivers = (drivers || []) as Driver[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-600 mt-1">
            Manage your delivery drivers and vehicles
          </p>
        </div>
        <Link href="/drivers/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedDrivers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Truck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedDrivers.filter(d => d.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owned Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedDrivers.filter(d => d.vehicle_type === 'owned').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drivers List */}
      <Card>
        <CardHeader>
          <CardTitle>All Drivers</CardTitle>
          <CardDescription>
            A list of all drivers in your system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typedDrivers.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No drivers</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding your first driver.
              </p>
              <div className="mt-6">
                <Link href="/drivers/new">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Driver
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {typedDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                      <Truck className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{driver.name}</h3>
                        <Badge
                          variant={driver.status === 'active' ? 'default' : 'secondary'}
                          className={
                            driver.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-100'
                              : ''
                          }
                        >
                          {driver.status}
                        </Badge>
                        <Badge variant="outline">
                          {driver.vehicle_type === 'owned' ? 'Owned' : 'External'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                        <span>{driver.email}</span>
                        <span>•</span>
                        <span>{driver.phone}</span>
                        {driver.vehicle_registration && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{driver.vehicle_registration}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/drivers/${driver.id}`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}