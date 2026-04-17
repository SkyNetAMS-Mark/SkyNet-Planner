/**
 * Import script for SkyNet postal codes and routes
 *
 * This script reads the Excel file with postal code ranges and route numbers,
 * creates routes (stored in regions table) and links postal_code_ranges to them.
 *
 * Usage:
 *   npx tsx scripts/import-postal-codes.ts
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - The Excel file at files/Collections zipcode timetable SkyNet 2025.xls
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as path from 'path'

// Load environment variables
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Color palette for routes
const COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#84CC16', // Lime
]

interface PostalCodeRow {
  fromPostCode: string
  toPostCode: string
  routeNumber: number
  deadlineTime: number
  pickupFrom: number
  pickupTo: number
}

function extractNumericPostalCode(value: string): string {
  // Extract only numeric part from postal codes like "1009ZZ"
  return value.replace(/[^0-9]/g, '')
}

async function main() {
  console.log('SkyNet Postal Code Import Script')
  console.log('================================\n')

  // Read the Excel file
  const excelPath = path.join(process.cwd(), 'files', 'Collections zipcode timetable SkyNet 2025.xls')
  console.log(`Reading Excel file: ${excelPath}\n`)

  const workbook = XLSX.readFile(excelPath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  // Parse the data (skip header rows)
  const postalCodeRows: PostalCodeRow[] = []
  for (let i = 4; i < rawData.length; i++) {
    const row = rawData[i]
    if (!row || !row[0] || row[2] === undefined) continue

    postalCodeRows.push({
      fromPostCode: extractNumericPostalCode(String(row[0])),
      toPostCode: extractNumericPostalCode(String(row[1])),
      routeNumber: Number(row[2]),
      deadlineTime: row[3] || 0,
      pickupFrom: row[4] || 0,
      pickupTo: row[5] || 0,
    })
  }

  console.log(`Found ${postalCodeRows.length} postal code ranges\n`)

  // Extract unique route numbers
  const uniqueRoutes = [...new Set(postalCodeRows.map(r => r.routeNumber))].sort((a, b) => a - b)
  console.log(`Found ${uniqueRoutes.length} unique routes: ${uniqueRoutes.join(', ')}\n`)

  // Step 1: Create routes (stored in regions table with route_number)
  console.log('Step 1: Creating routes...')
  const routeIdMap = new Map<number, string>()

  for (let i = 0; i < uniqueRoutes.length; i++) {
    const routeNumber = uniqueRoutes[i]
    const color = COLORS[i % COLORS.length]

    // Check if route already exists
    const { data: existingRoute } = await supabase
      .from('regions')
      .select('id')
      .eq('route_number', routeNumber)
      .single()

    if (existingRoute) {
      console.log(`  Route ${routeNumber} already exists (id: ${existingRoute.id})`)
      routeIdMap.set(routeNumber, existingRoute.id)
    } else {
      const { data: newRoute, error } = await supabase
        .from('regions')
        .insert({
          route_number: routeNumber,
          name: routeNumber === 0 ? 'Unassigned' : `Route ${routeNumber}`,
          color: color,
          is_active: routeNumber !== 0, // Route 0 is inactive (unassigned)
          lead_time_days: 0,
        })
        .select('id')
        .single()

      if (error) {
        console.error(`  Error creating route ${routeNumber}:`, error.message)
      } else {
        console.log(`  Created route ${routeNumber} (id: ${newRoute.id})`)
        routeIdMap.set(routeNumber, newRoute.id)
      }
    }
  }

  console.log(`\nRoutes created/verified: ${routeIdMap.size}\n`)

  // Step 2: Create postal code ranges linked to routes
  console.log('Step 2: Creating postal code ranges...')
  let created = 0
  let skipped = 0
  let errors = 0

  for (const row of postalCodeRows) {
    const routeId = routeIdMap.get(row.routeNumber)

    if (!routeId) {
      console.error(`  No route ID for route number ${row.routeNumber}`)
      errors++
      continue
    }

    // Check if range already exists
    const { data: existingRange } = await supabase
      .from('postal_code_ranges')
      .select('id')
      .eq('range_start', row.fromPostCode)
      .eq('range_end', row.toPostCode)
      .single()

    if (existingRange) {
      // Update existing range with route_id (region_id)
      const { error: updateError } = await supabase
        .from('postal_code_ranges')
        .update({ region_id: routeId })
        .eq('id', existingRange.id)

      if (updateError) {
        console.error(`  Error updating range ${row.fromPostCode}-${row.toPostCode}:`, updateError.message)
        errors++
      } else {
        skipped++
      }
    } else {
      // Create new range
      const { error: insertError } = await supabase
        .from('postal_code_ranges')
        .insert({
          range_start: row.fromPostCode,
          range_end: row.toPostCode,
          region_id: routeId,
          country_code: 'NL',
          city: null,
        })

      if (insertError) {
        console.error(`  Error creating range ${row.fromPostCode}-${row.toPostCode}:`, insertError.message)
        errors++
      } else {
        created++
      }
    }
  }

  console.log(`\nPostal code ranges: ${created} created, ${skipped} updated, ${errors} errors\n`)

  // Summary
  console.log('================================')
  console.log('Import Complete!')
  console.log('================================')
  console.log(`Routes:        ${routeIdMap.size}`)
  console.log(`Postal Ranges: ${created + skipped} (${created} new, ${skipped} updated)`)
  console.log(`Errors:        ${errors}`)
  console.log('')
  console.log('Next steps:')
  console.log('1. Review the routes at /routes in the admin panel')
  console.log('2. Set up schedules for each route at /schedules')
  console.log('3. Configure lead time for remote routes (islands) if needed')
}

main().catch(console.error)
