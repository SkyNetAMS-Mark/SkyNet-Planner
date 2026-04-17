-- Add lead_time_days column to regions table
-- This allows setting extra days for remote areas like islands (Texel, Ameland, etc.)

ALTER TABLE regions
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 0;

-- Add a check constraint to ensure lead_time_days is non-negative
ALTER TABLE regions
ADD CONSTRAINT check_lead_time_days_positive CHECK (lead_time_days >= 0);

-- Add a comment to explain the field
COMMENT ON COLUMN regions.lead_time_days IS 'Extra days required before delivery is available (e.g., +1 for islands/remote areas)';
