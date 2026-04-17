'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, Upload, Download, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

export default function UploadParcelsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [senders, setSenders] = useState<Array<{ id: string; company_name: string; email: string }>>([])
  const [uploadResults, setUploadResults] = useState<{
    success: number
    failed: number
    errors: Array<{ row: number; message: string }>
  } | null>(null)
  const [pastedData, setPastedData] = useState('')
  const [uploadMethod, setUploadMethod] = useState<'file' | 'paste'>('file')

  useEffect(() => {
    async function loadSenders() {
      const { data } = await supabase
        .from('senders')
        .select('id, company_name, email')
        .eq('is_active', true)
        .order('company_name')

      if (data) {
        setSenders(data)
      }
    }
    loadSenders()
  }, [supabase])

  const downloadTemplate = () => {
    // Template matches the exact format expected by the upload validation
    const csv = `sender_company,sender_email,receiver_name,receiver_email,receiver_phone,receiver_address,receiver_postal_code,notes,weight_kg,dimensions_cm
E-Commerce Shop A,shop.a@example.com,John Doe,john.doe@example.com,+32 123 456 789,Rue de la Loi 16,1000,Fragile - Handle with care,2.5,30x20x15
E-Commerce Shop B,shop.b@example.com,Jane Smith,jane.smith@example.com,0032-987654321,Avenue Louise 54,1050,Express delivery,3.8,40x30x20
Online Store C,store.c@example.com,Bob Johnson,bob.j@example.com,02-1234567,Chaussée de Charleroi 112,1060,,1.2,25x15x10`
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'parcels-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const processCSVData = async (text: string) => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setUploadResults(null)

    try {
      const lines = text.split('\n').filter(line => line.trim())
      
      // Parse CSV properly handling quoted values
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }
      
      const headers = parseCSVLine(lines[0])
      const parcelsToCreate = []
      const errors: Array<{ row: number; message: string }> = []

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        
        if (values.length < headers.length) continue

        const parcelData: any = {}
        headers.forEach((header, index) => {
          parcelData[header] = values[index] || ''
        })

        // Validate required fields with detailed error messages
        const missingFields = []
        if (!parcelData.sender_company?.trim()) missingFields.push('sender_company')
        if (!parcelData.receiver_name?.trim()) missingFields.push('receiver_name')
        if (!parcelData.receiver_email?.trim()) missingFields.push('receiver_email')
        if (!parcelData.receiver_phone?.trim()) missingFields.push('receiver_phone')
        if (!parcelData.receiver_address?.trim()) missingFields.push('receiver_address')
        if (!parcelData.receiver_postal_code?.trim()) missingFields.push('receiver_postal_code')

        if (missingFields.length > 0) {
          errors.push({
            row: i + 1,
            message: `Missing required fields: ${missingFields.join(', ')}`
          })
          continue
        }

        // Validate postal code
        const postalCode = parseInt(parcelData.receiver_postal_code)
        if (isNaN(postalCode)) {
          errors.push({
            row: i + 1,
            message: `Invalid postal code: "${parcelData.receiver_postal_code}" is not a number`
          })
          continue
        }
        if (postalCode < 1000 || postalCode > 9999) {
          errors.push({
            row: i + 1,
            message: `Invalid postal code: ${postalCode} (must be between 1000-9999)`
          })
          continue
        }

        // Find or create sender
        const senderEmail = parcelData.sender_email?.trim() ||
          `${parcelData.sender_company.toLowerCase().replace(/\s+/g, '')}@example.com`
        
        let sender = senders.find(s =>
          s.company_name.toLowerCase() === parcelData.sender_company.toLowerCase() ||
          (parcelData.sender_email && s.email.toLowerCase() === parcelData.sender_email.toLowerCase())
        )

        if (!sender) {
          const { data: newSender, error: senderError } = await (supabase as any)
            .from('senders')
            .insert([{
              company_name: parcelData.sender_company.trim(),
              email: senderEmail,
            }])
            .select()
            .single()

          if (senderError || !newSender) {
            errors.push({
              row: i + 1,
              message: `Failed to create sender "${parcelData.sender_company}": ${senderError?.message || 'Unknown error'}`
            })
            continue
          }
          const typedSender = newSender as { id: string; company_name: string; email: string }
          sender = typedSender
          setSenders([...senders, typedSender])
        }

        if (!sender) {
          errors.push({ row: i + 1, message: 'Failed to resolve sender' })
          continue
        }

        parcelsToCreate.push({
          sender_id: sender.id,
          receiver_name: parcelData.receiver_name,
          receiver_email: parcelData.receiver_email,
          receiver_phone: parcelData.receiver_phone,
          receiver_address: parcelData.receiver_address,
          receiver_postal_code: postalCode,
          delivery_date: null, // Will be set when customer selects slot
          notes: parcelData.notes || null,
          weight_kg: parcelData.weight_kg ? parseFloat(parcelData.weight_kg) : null,
          dimensions_cm: parcelData.dimensions_cm || null,
          special_instructions: parcelData.special_instructions || null,
        })
      }

      // Insert parcels
      let successCount = 0
      for (const parcel of parcelsToCreate) {
        const { error: insertError } = await (supabase as any)
          .from('parcels')
          .insert([parcel])

        if (insertError) {
          const rowNum = parcelsToCreate.indexOf(parcel) + 2
          errors.push({
            row: rowNum,
            message: `Database error: ${insertError.message}`
          })
        } else {
          successCount++
        }
      }

      setUploadResults({
        success: successCount,
        failed: errors.length,
        errors: errors.slice(0, 10), // Show first 10 errors
      })

      if (successCount > 0) {
        setSuccess(`Successfully uploaded ${successCount} parcel(s)${errors.length > 0 ? ` (${errors.length} failed)` : ''}`)
      } else {
        setError('Failed to upload parcels. Please check the file format.')
      }

      setLoading(false)
    } catch (err) {
      setError('Failed to parse CSV data. Please check the format.')
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Check if it's an Excel file
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const csvData = XLSX.utils.sheet_to_csv(firstSheet)
        await processCSVData(csvData)
      } else {
        // Handle as CSV
        const text = await file.text()
        await processCSVData(text)
      }
    } catch (err) {
      setError('Failed to read file. Please ensure it is a valid CSV or Excel file.')
    }
  }

  const handlePasteUpload = async () => {
    if (!pastedData.trim()) {
      setError('Please paste CSV data first')
      return
    }
    await processCSVData(pastedData)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/parcels">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upload Parcels</h1>
          <p className="text-gray-600 mt-1">
            Bulk upload parcels from CSV file
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Parcels</CardTitle>
            <CardDescription>
              Choose upload method: file or paste from Excel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Method Tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setUploadMethod('file')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  uploadMethod === 'file'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setUploadMethod('paste')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  uploadMethod === 'paste'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Paste from Excel
              </button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-50 text-green-900 border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {uploadMethod === 'file' ? (
              <div className="space-y-2">
                <Label htmlFor="file">CSV or Excel File *</Label>
                <input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-gray-500">
                  Accepts: CSV (.csv), Excel (.xlsx, .xls)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="paste">Paste CSV Data from Excel *</Label>
                <textarea
                  id="paste"
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  placeholder="Copy cells from Excel and paste here (including headers)..."
                  disabled={loading}
                  rows={10}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                />
                <p className="text-xs text-gray-500">
                  Tip: Select cells in Excel (including header row), copy (Ctrl+C / Cmd+C), and paste here
                </p>
                <Button
                  onClick={handlePasteUpload}
                  disabled={loading || !pastedData.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Pasted Data
                    </>
                  )}
                </Button>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing parcels...
              </div>
            )}

            {uploadResults && (
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Success</p>
                        <p className="text-2xl font-bold text-green-600">{uploadResults.success}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-red-900">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{uploadResults.failed}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {uploadResults.errors.length > 0 && (
                  <div className="rounded-lg bg-red-50 p-4 border border-red-200">
                    <p className="text-sm font-medium text-red-900 mb-2">Errors:</p>
                    <ul className="text-sm text-red-800 space-y-1">
                      {uploadResults.errors.map((err, idx) => (
                        <li key={idx}>Row {err.row}: {err.message}</li>
                      ))}
                      {uploadResults.failed > 10 && (
                        <li className="text-red-600">...and {uploadResults.failed - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}

                {uploadResults.success > 0 && (
                  <Link href="/parcels">
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                      View Uploaded Parcels
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Instructions</CardTitle>
            <CardDescription>
              How to prepare and upload your parcel data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">Required CSV Columns</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><strong>sender_company</strong> - Name of the e-commerce company</li>
                <li><strong>receiver_name</strong> - Customer's full name</li>
                <li><strong>receiver_email</strong> - Customer's email address</li>
                <li><strong>receiver_phone</strong> - Customer's phone number</li>
                <li><strong>receiver_address</strong> - Full delivery address</li>
                <li><strong>receiver_postal_code</strong> - Belgian postal code (1000-9999)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">Optional Columns</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><strong>sender_email</strong> - Sender's email (auto-generated if missing)</li>
                <li><strong>notes</strong> - Internal notes about the parcel</li>
                <li><strong>weight_kg</strong> - Package weight in kilograms</li>
                <li><strong>dimensions_cm</strong> - Package dimensions (e.g., 30x20x15)</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-3">Download Template</h4>
              <p className="text-xs text-gray-500 mb-2">
                Download as CSV, then open in Excel if needed
              </p>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2 text-amber-700">Important Notes</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Postal codes must be valid Belgian codes (1000-9999)</li>
                <li>Postal codes must be assigned to a region</li>
                <li>Delivery date will be set when customer selects a slot</li>
                <li>Senders will be created automatically if they don't exist</li>
                <li>Each parcel gets a unique tracking number and secret token</li>
                <li><strong>Excel files:</strong> Upload .xlsx or .xls files directly, or use "Paste from Excel" tab</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-2">After Upload</h4>
              <p className="text-sm text-gray-600">
                Once uploaded, you can trigger the N8N webhook to send email notifications to customers with their unique slot selection links.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}