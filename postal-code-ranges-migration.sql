-- Migration to Postal Code Ranges System
-- Run this in Supabase SQL Editor

-- 1. Create the new postal_code_ranges table (if not already created)
CREATE TABLE IF NOT EXISTS postal_code_ranges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  range_start TEXT NOT NULL,
  range_end TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  country_code TEXT NOT NULL DEFAULT 'BE',
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postal_code_ranges_region ON postal_code_ranges(region_id);
CREATE INDEX IF NOT EXISTS idx_postal_code_ranges_country ON postal_code_ranges(country_code);

-- 2. Create function to check if postal code is in range
CREATE OR REPLACE FUNCTION is_postal_code_in_range(
  code TEXT,
  range_start TEXT,
  range_end TEXT,
  country TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  IF country = 'BE' THEN
    -- Belgian numeric comparison
    BEGIN
      RETURN code::INTEGER >= range_start::INTEGER 
         AND code::INTEGER <= range_end::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;
  ELSIF country = 'NL' THEN
    -- Dutch alphanumeric comparison
    RETURN code >= range_start AND code <= range_end;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to find region from postal code using ranges
CREATE OR REPLACE FUNCTION find_region_from_postal_code(postal_code TEXT)
RETURNS UUID AS $$
DECLARE
  found_region_id UUID;
BEGIN
  -- Try to find a matching range
  SELECT region_id INTO found_region_id
  FROM postal_code_ranges
  WHERE is_postal_code_in_range(postal_code, range_start, range_end, country_code)
  ORDER BY 
    -- Prioritize exact matches (range_start = range_end)
    CASE WHEN range_start = range_end THEN 0 ELSE 1 END,
    -- Then prioritize smaller ranges
    CASE 
      WHEN country_code = 'BE' THEN (range_end::INTEGER - range_start::INTEGER)
      ELSE LENGTH(range_end) - LENGTH(range_start)
    END
  LIMIT 1;
  
  RETURN found_region_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Update the trigger to use the new function
DROP TRIGGER IF EXISTS assign_parcel_region ON parcels;

CREATE OR REPLACE FUNCTION assign_region_from_postal_code_range()
RETURNS TRIGGER AS $$
BEGIN
  -- Find region using the new range-based function
  NEW.region_id := find_region_from_postal_code(NEW.receiver_postal_code::TEXT);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_parcel_region BEFORE INSERT OR UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION assign_region_from_postal_code_range();

-- 5. Migrate existing postal_codes to postal_code_ranges (optional)
-- This converts individual codes to single-code ranges
INSERT INTO postal_code_ranges (range_start, range_end, region_id, country_code, city)
SELECT 
  code::TEXT as range_start,
  code::TEXT as range_end,
  region_id,
  'BE' as country_code,
  city
FROM postal_codes
ON CONFLICT DO NOTHING;

-- 6. Add trigger for postal_code_ranges updated_at
CREATE TRIGGER update_postal_code_ranges_updated_at BEFORE UPDATE ON postal_code_ranges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Postal code ranges system activated!';
  RAISE NOTICE 'Old postal_codes table is still available for reference';
  RAISE NOTICE 'New parcels will use postal_code_ranges for region assignment';
END $$;