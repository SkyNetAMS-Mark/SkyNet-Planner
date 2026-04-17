-- Refactor: Regions become Routes
-- The regions table will now represent delivery routes (304, 305, etc.)
-- Each route has postal code ranges assigned to it

-- Add route_number to regions table
ALTER TABLE regions ADD COLUMN IF NOT EXISTS route_number INTEGER UNIQUE;

-- Create index on route_number
CREATE INDEX IF NOT EXISTS idx_regions_route_number ON regions(route_number);

-- Drop the separate routes table (it's redundant now)
-- First remove the foreign key references
ALTER TABLE postal_code_ranges DROP CONSTRAINT IF EXISTS postal_code_ranges_route_id_fkey;
ALTER TABLE region_schedules DROP CONSTRAINT IF EXISTS region_schedules_route_id_fkey;

-- Drop route_id columns (we'll use region_id which now represents routes)
ALTER TABLE postal_code_ranges DROP COLUMN IF EXISTS route_id;
ALTER TABLE region_schedules DROP COLUMN IF EXISTS route_id;

-- Remove driver_id from region_schedules (not needed per requirements)
ALTER TABLE region_schedules DROP COLUMN IF EXISTS driver_id;

-- Drop the routes table
DROP TABLE IF EXISTS routes;

-- Add comments to clarify the new structure
COMMENT ON TABLE regions IS 'Delivery routes (e.g., 304, 305) with their postal code ranges. Named "regions" for legacy compatibility but represents routes.';
COMMENT ON COLUMN regions.route_number IS 'The route number (e.g., 304, 305) used by drivers and logistics';
COMMENT ON COLUMN regions.name IS 'Display name for the route (e.g., "Route 304" or "Amsterdam Noord")';
