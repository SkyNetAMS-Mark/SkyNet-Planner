-- Create routes table for fixed route numbers (304, 305, etc.)
-- Routes are permanent and linked to regions/postal codes

CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_number INTEGER NOT NULL UNIQUE,
  name TEXT, -- optional friendly name like "Amsterdam Noord"
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_routes_is_active ON routes(is_active);

-- Add route_id to postal_code_ranges
ALTER TABLE postal_code_ranges
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE SET NULL;

-- Add route_id to region_schedules
ALTER TABLE region_schedules
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE SET NULL;

-- Create updated_at trigger for routes
CREATE OR REPLACE FUNCTION update_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS routes_updated_at ON routes;
CREATE TRIGGER routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION update_routes_updated_at();

-- Add comment to explain the table
COMMENT ON TABLE routes IS 'Fixed route numbers used by SkyNet for delivery planning (e.g., 304, 305, 306)';
COMMENT ON COLUMN routes.route_number IS 'The unique route number used by drivers and logistics';
