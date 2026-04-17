'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Package, Upload, Search, Mail, Loader2, Download, Bell, Truck, FileSpreadsheet, CalendarIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export default function ParcelsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const statusFilter = searchParams.get('status')

  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [sendingDeliveryReminders, setSendingDeliveryReminders] = useState(false)
  const [parcels, setParcels] = useState<any[]>([])
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportDate, setExportDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exporting, setExporting] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    slot_selected: 0,
    in_transit: 0,
    delivered: 0,
  })

  useEffect(() => {
    async function loadParcels() {
      setLoading(true)

      // Build query
      let query = supabase
        .from('parcels')
        .select(`
          *,
          senders (company_name),
          regions (name, color),
          region_schedules (
            day_of_week,
            delivery_periods (name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      // Apply status filter if present
      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching parcels:', error)
      }

      setParcels(data || [])

      // Calculate stats (always from all parcels)
      const { data: allParcels } = await supabase
        .from('parcels')
        .select('status')

      if (allParcels) {
        const typedParcels = allParcels as Array<{ status: string }>
        setStats({
          total: typedParcels.length,
          pending: typedParcels.filter(p => p.status === 'pending').length,
          slot_selected: typedParcels.filter(p => p.status === 'slot_selected').length,
          in_transit: typedParcels.filter(p => p.status === 'in_transit').length,
          delivered: typedParcels.filter(p => p.status === 'delivered').length,
        })
      }

      setLoading(false)
    }

    loadParcels()
  }, [statusFilter, supabase])

  const handleSendInvite = async (parcelId: string, receiverEmail: string) => {
    setSendingEmail(parcelId)

    try {
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to send invite')
        setSendingEmail(null)
        return
      }

      toast.success(`Invite email sent to ${receiverEmail}`)
      
      // Reload parcels to update status
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err: any) {
      toast.error('Failed to send invite: ' + err.message)
      setSendingEmail(null)
    }
  }

  const handleSendReminder = async (parcelId: string, receiverEmail: string) => {
    setSendingEmail(parcelId)

    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to send reminder')
        setSendingEmail(null)
        return
      }

      toast.success(`Reminder email sent to ${receiverEmail}`)
      setSendingEmail(null)
    } catch (err: any) {
      toast.error('Failed to send reminder: ' + err.message)
      setSendingEmail(null)
    }
  }

  const handleSendBulkReminders = async () => {
    const pendingParcels = parcels.filter(p => p.status === 'pending' && !p.token_used)

    if (pendingParcels.length === 0) {
      toast.error('No pending parcels to send reminders to')
      return
    }

    if (!confirm(`Send reminder emails to ${pendingParcels.length} customer(s)?`)) {
      return
    }

    toast.success(`Reminder emails sent to ${pendingParcels.length} customer(s)!`)
  }

  const handleSendDeliveryReminders = async () => {
    if (!confirm("Send delivery day reminder emails to all customers with deliveries scheduled for today?")) {
      return
    }

    setSendingDeliveryReminders(true)

    try {
      const response = await fetch('/api/send-delivery-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendAll: true })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to send delivery reminders')
        setSendingDeliveryReminders(false)
        return
      }

      if (data.results.sent === 0) {
        toast.info(data.message || 'No parcels need delivery reminders today')
      } else {
        toast.success(`Sent ${data.results.sent} delivery reminder(s)!`)
      }

      if (data.results.failed > 0) {
        toast.warning(`${data.results.failed} email(s) failed to send`)
      }
    } catch (err: any) {
      toast.error('Failed to send delivery reminders: ' + err.message)
    } finally {
      setSendingDeliveryReminders(false)
    }
  }

  const exportToCSV = () => {
    if (parcels.length === 0) {
      toast.error('No parcels to export')
      return
    }

    const csvData = parcels.map(p => ({
      'Tracking Number': p.tracking_number,
      'Status': p.status,
      'Receiver Name': p.receiver_name,
      'Receiver Email': p.receiver_email,
      'Receiver Phone': p.receiver_phone,
      'Address': p.receiver_address,
      'Postal Code': p.receiver_postal_code,
      'Region': p.regions?.name || '',
      'Delivery Date': p.delivery_date || '',
      'Sender': p.senders?.company_name || '',
      'Created': format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
    }))

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parcels-${statusFilter || 'all'}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success(`Exported ${parcels.length} parcel(s) to CSV`)
  }

  const exportToExcel = () => {
    if (parcels.length === 0) {
      toast.error('No parcels to export')
      return
    }

    const excelData = parcels.map(p => ({
      'Tracking Number': p.tracking_number,
      'Status': p.status,
      'Receiver Name': p.receiver_name,
      'Receiver Email': p.receiver_email,
      'Receiver Phone': p.receiver_phone,
      'Address': p.receiver_address,
      'Postal Code': p.receiver_postal_code,
      'Region': p.regions?.name || '',
      'Delivery Date': p.delivery_date || '',
      'Time Slot': p.region_schedules?.delivery_periods?.name || '',
      'Sender': p.senders?.company_name || '',
      'Notes': p.notes || '',
      'Weight (kg)': p.weight_kg || '',
      'Dimensions': p.dimensions_cm || '',
      'Created': format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Parcels')
    XLSX.writeFile(wb, `parcels-${statusFilter || 'all'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
    
    toast.success(`Exported ${parcels.length} parcel(s) to Excel`)
  }

  const exportRouteList = async () => {
    setExporting(true)

    try {
      // Fetch parcels for the selected date with full slot details
      const { data: routeParcels, error } = await supabase
        .from('parcels')
        .select(`
          *,
          senders (company_name),
          regions (name),
          region_schedules!selected_slot_id (
            route_id,
            routes (route_number),
            delivery_periods (name, start_time, end_time)
          )
        `)
        .eq('delivery_date', exportDate)
        .not('selected_slot_id', 'is', null)
        .in('status', ['slot_selected', 'in_transit'])
        .order('receiver_postal_code')

      if (error) {
        toast.error('Failed to fetch parcels: ' + error.message)
        setExporting(false)
        return
      }

      if (!routeParcels || routeParcels.length === 0) {
        toast.error(`No parcels with selected slots for ${exportDate}`)
        setExporting(false)
        return
      }

      // Format time window from delivery period
      const formatTimeWindow = (schedule: any) => {
        if (!schedule?.delivery_periods) return ''
        const start = schedule.delivery_periods.start_time?.slice(0, 5) || ''
        const end = schedule.delivery_periods.end_time?.slice(0, 5) || ''
        return `${start} - ${end}`
      }

      // Sort by route number, then by postal code
      const sortedParcels = routeParcels.sort((a: any, b: any) => {
        const routeA = a.region_schedules?.routes?.route_number || 999
        const routeB = b.region_schedules?.routes?.route_number || 999
        if (routeA !== routeB) return routeA - routeB
        return (a.receiver_postal_code || 0) - (b.receiver_postal_code || 0)
      })

      // Build export data
      const excelData = sortedParcels.map((p: any, index: number) => ({
        '#': index + 1,
        'Route': p.region_schedules?.routes?.route_number || '',
        'Tracking Number': p.tracking_number,
        'Time Window': formatTimeWindow(p.region_schedules),
        'Receiver Name': p.receiver_name,
        'Phone': p.receiver_phone,
        'Address': p.receiver_address,
        'Postal Code': p.receiver_postal_code,
        'Region': p.regions?.name || '',
        'Sender': p.senders?.company_name || '',
        'Special Instructions': p.special_instructions || '',
        'Notes': p.notes || '',
      }))

      // Create Excel workbook
      const ws = XLSX.utils.json_to_sheet(excelData)

      // Set column widths
      ws['!cols'] = [
        { wch: 4 },   // #
        { wch: 8 },   // Route
        { wch: 16 },  // Tracking
        { wch: 14 },  // Time Window
        { wch: 25 },  // Name
        { wch: 15 },  // Phone
        { wch: 40 },  // Address
        { wch: 10 },  // Postal Code
        { wch: 15 },  // Region
        { wch: 20 },  // Sender
        { wch: 30 },  // Special Instructions
        { wch: 30 },  // Notes
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Route List')
      XLSX.writeFile(wb, `route-list-${exportDate}.xlsx`)

      toast.success(`Exported ${routeParcels.length} parcel(s) for ${exportDate}`)
      setExportDialogOpen(false)
    } catch (err: any) {
      toast.error('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const setFilter = (status: string | null) => {
    if (status) {
      router.push(`/parcels?status=${status}`)
    } else {
      router.push('/parcels')
    }
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    slot_selected: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    in_transit: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
    delivered: 'bg-green-100 text-green-800 hover:bg-green-200',
    failed: 'bg-red-100 text-red-800 hover:bg-red-200',
    cancelled: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parcels</h1>
          <p className="text-gray-600 mt-1">
            Track and manage all parcel deliveries
            {statusFilter && (
              <span className="ml-2">
                • Filtered by: <strong>{statusFilter.replace('_', ' ')}</strong>
                <button
                  onClick={() => setFilter(null)}
                  className="ml-2 text-indigo-600 hover:underline text-sm"
                >
                  Clear filter
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportToCSV}>
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Route List...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={handleSendDeliveryReminders}
            disabled={sendingDeliveryReminders}
          >
            {sendingDeliveryReminders ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Truck className="mr-2 h-4 w-4" />
                Today's Reminders
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleSendBulkReminders}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Reminders
          </Button>
          <Link href="/parcels/upload">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload Parcels
            </Button>
          </Link>
        </div>
      </div>

      {/* Clickable Stats */}
      <div className="grid gap-6 md:grid-cols-5">
        <button
          onClick={() => setFilter(null)}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer",
            !statusFilter && "ring-2 ring-indigo-600"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All parcels</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => setFilter('pending')}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'pending' && "ring-2 ring-yellow-600"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Package className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting selection</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => setFilter('slot_selected')}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'slot_selected' && "ring-2 ring-blue-600"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Slot Selected</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.slot_selected}</div>
              <p className="text-xs text-muted-foreground">Ready for delivery</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => setFilter('in_transit')}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'in_transit' && "ring-2 ring-purple-600"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.in_transit}</div>
              <p className="text-xs text-muted-foreground">Out for delivery</p>
            </CardContent>
          </Card>
        </button>

        <button
          onClick={() => setFilter('delivered')}
          className="text-left"
        >
          <Card className={cn(
            "transition-all cursor-pointer hover:shadow-md",
            statusFilter === 'delivered' && "ring-2 ring-green-600"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.delivered}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Parcels List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {statusFilter
                  ? `${statusFilter.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Parcels`
                  : 'Recent Parcels'}
              </CardTitle>
              <CardDescription>
                {statusFilter
                  ? `Showing parcels with status: ${statusFilter.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}`
                  : 'Latest 50 parcels in the system'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : parcels.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                {statusFilter ? `No ${statusFilter} parcels` : 'No parcels'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {statusFilter 
                  ? 'Try selecting a different filter or clear the current filter.'
                  : 'Get started by uploading your first batch of parcels.'}
              </p>
              <div className="mt-6">
                {statusFilter ? (
                  <Button onClick={() => setFilter(null)} variant="outline">
                    Clear Filter
                  </Button>
                ) : (
                  <Link href="/parcels/upload">
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Parcels
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {parcels.map((parcel) => (
                <div key={parcel.id} className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <Link href={`/parcels/${parcel.id}`} className="flex-1">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">
                            {parcel.tracking_number}
                          </span>
                          <Badge className={statusColors[parcel.status as keyof typeof statusColors]}>
                            {parcel.status.replace('_', ' ')}
                          </Badge>
                          {!parcel.token_used && parcel.status === 'pending' && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Awaiting Selection
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="font-medium text-gray-900">{parcel.receiver_name}</span>
                          <span>•</span>
                          <span>{parcel.receiver_postal_code}</span>
                          {parcel.regions && (
                            <>
                              <span>•</span>
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: parcel.regions.color,
                                  color: parcel.regions.color,
                                }}
                              >
                                {parcel.regions.name}
                              </Badge>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {parcel.senders && (
                            <span>From: {parcel.senders.company_name}</span>
                          )}
                          {parcel.delivery_date && (
                            <>
                              <span>•</span>
                              <span>Delivery: {format(new Date(parcel.delivery_date), 'MMM dd, yyyy')}</span>
                            </>
                          )}
                          {parcel.region_schedules?.delivery_periods && (
                            <>
                              <span>•</span>
                              <span>{parcel.region_schedules.delivery_periods.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      {/* Send Invite Button - Only if not sent yet */}
                      {parcel.status === 'pending' && !parcel.invite_sent_at && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            handleSendInvite(parcel.id, parcel.receiver_email)
                          }}
                          disabled={sendingEmail === parcel.id}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {sendingEmail === parcel.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Invite
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Send Reminder Button - Only if invite sent and slot not selected */}
                      {parcel.status === 'pending' && parcel.invite_sent_at && !parcel.token_used && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            handleSendReminder(parcel.id, parcel.receiver_email)
                          }}
                          disabled={sendingEmail === parcel.id}
                        >
                          {sendingEmail === parcel.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Bell className="mr-2 h-4 w-4" />
                              Reminder
                            </>
                          )}
                        </Button>
                      )}
                      
                      <Link href={`/parcels/${parcel.id}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Route List Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Route List</DialogTitle>
            <DialogDescription>
              Export a driver route list for a specific delivery date. Includes time windows, route numbers, and delivery details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-date">Delivery Date</Label>
              <Input
                id="export-date"
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
              />
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Export includes:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Route number</li>
                <li>Time window (e.g., 09:00 - 13:00)</li>
                <li>Receiver name, phone, address</li>
                <li>Postal code and region</li>
                <li>Special instructions and notes</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={exportRouteList}
              disabled={exporting || !exportDate}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export to Excel
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}