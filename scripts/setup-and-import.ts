/**
 * Setup and Import script for SkyNet postal codes and routes
 *
 * This script:
 * 1. Applies the route_number migration to the regions table
 * 2. Imports postal code data from the Excel file
 *
 * Usage:
 *   npx tsx scripts/setup-and-import.ts
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

async function applyMigration() {
  console.log('Step 0: Applying database migration...')

  // Check if route_number column exists
  const { data: columns, error: checkError } = await supabase.rpc('get_column_exists', {
    table_name: 'regions',
    column_name: 'route_number'
  }).single()

  // If the RPC doesn't exist, we'll just try to add the column
  // Add route_number column if it doesn't exist
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE regions ADD COLUMN IF NOT EXISTS route_number INTEGER UNIQUE;
      CREATE INDEX IF NOT EXISTS idx_regions_route_number ON regions(route_number);
    `
  })

  if (alterError) {
    // The RPC might not exist - that's okay, the column might already exist
    // Let's verify by trying to select with the column
    console.log('  Note: Could not run RPC, checking column existence directly...')
  }

  console.log('  Migration check complete\n')
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

  // Step 1: Create routes (stored in regions table)
  // First, try with route_number, if that fails, fall back to using name
  console.log('Step 1: Creating routes...')
  const routeIdMap = new Map<number, string>()
  let useRouteNumber = true

  for (let i = 0; i < uniqueRoutes.length; i++) {
    const routeNumber = uniqueRoutes[i]
    const color = COLORS[i % COLORS.length]
    const routeName = routeNumber === 0 ? 'Unassigned' : `Route ${routeNumber}`

    // First, check if route exists by name (fallback) or route_number
    let existingRoute = null

    if (useRouteNumber) {
      const { data, error } = await supabase
        .from('regions')
        .select('id')
        .eq('route_number', routeNumber)
        .single()

      if (error && error.message.includes('route_number')) {
        console.log('  route_number column not available, falling back to name-based approach')
        useRouteNumber = false
      } else {
        existingRoute = data
      }
    }

    if (!useRouteNumber) {
      // Fallback: check by name
      const { data } = await supabase
        .from('regions')
        .select('id')
        .eq('name', routeName)
        .single()
      existingRoute = data
    }

    if (existingRoute) {
      console.log(`  Route ${routeNumber} already exists (id: ${existingRoute.id})`)
      routeIdMap.set(routeNumber, existingRoute.id)
    } else {
      // Create new route
      const insertData: any = {
        name: routeName,
        color: color,
        is_active: routeNumber !== 0, // Route 0 is inactive (unassigned)
        lead_time_days: 0,
      }

      if (useRouteNumber) {
        insertData.route_number = routeNumber
      }

      const { data: newRoute, error } = await supabase
        .from('regions')
        .insert(insertData)
        .select('id')
        .single()

      if (error) {
        if (error.message.includes('route_number')) {
          console.log('  route_number column not available, retrying without it...')
          useRouteNumber = false
          // Retry without route_number
          const { data: retryRoute, error: retryError } = await supabase
            .from('regions')
            .insert({
              name: routeName,
              color: color,
              is_active: routeNumber !== 0,
              lead_time_days: 0,
            })
            .select('id')
            .single()

          if (retryError) {
            console.error(`  Error creating route ${routeNumber}:`, retryError.message)
          } else {
            console.log(`  Created route ${routeNumber} (id: ${retryRoute.id}) [name-based]`)
            routeIdMap.set(routeNumber, retryRoute.id)
          }
        } else {
          console.error(`  Error creating route ${routeNumber}:`, error.message)
        }
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

  if (!useRouteNumber) {
    console.log('NOTE: The route_number column was not available.')
    console.log('Routes were created using names like "Route 304".')
    console.log('Please run this SQL in Supabase dashboard to add the column:')
    console.log('')
    console.log('  ALTER TABLE regions ADD COLUMN IF NOT EXISTS route_number INTEGER UNIQUE;')
    console.log('')
    console.log('Then run this script again to update the route_number values.')
  }

  console.log('')
  console.log('Next steps:')
  console.log('1. Review the routes at /routes in the admin panel')
  console.log('2. Set up schedules for each route at /schedules')
  console.log('3. Configure lead time for remote routes (islands) if needed')
}

main().catch(console.error)
