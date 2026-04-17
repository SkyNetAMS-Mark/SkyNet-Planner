-- Weekly Schedule Overrides
-- Allows temporary changes to the base schedule template for specific weeks
-- For example: reduce capacity during holidays, close a route for a week, etc.

CREATE TABLE IF NOT EXISTS weekly_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference to the base schedule being overridden
  base_schedule_id UUID NOT NULL REFERENCES region_schedules(id) ON DELETE CASCADE,

  -- The Monday of the week this override applies to
  week_start DATE NOT NULL,

  -- Override values (NULL means use base template value)
  max_deliveries INTEGER,  -- Override capacity
  is_active BOOLEAN,       -- Override active status (e.g., disable for holiday)
  notes TEXT,              -- Optional notes for why this override exists

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each schedule can only have one override per week
  UNIQUE(base_schedule_id, week_start)
);

-- Index for efficient lookups by week
CREATE INDEX IF NOT EXISTS idx_weekly_overrides_week_start
ON weekly_schedule_overrides(week_start);

-- Index for looking up all overrides for a base schedule
CREATE INDEX IF NOT EXISTS idx_weekly_overrides_base_schedule
ON weekly_schedule_overrides(base_schedule_id);

-- Add comment explaining the table
COMMENT ON TABLE weekly_schedule_overrides IS
'Stores temporary weekly modifications to base schedules. NULL values mean use the base schedule value.';

COMMENT ON COLUMN weekly_schedule_overrides.week_start IS
'The Monday of the week this override applies to. All dates should be Mondays.';

COMMENT ON COLUMN weekly_schedule_overrides.max_deliveries IS
'Override for max deliveries. NULL = use base template value.';

COMMENT ON COLUMN weekly_schedule_overrides.is_active IS
'Override for active status. NULL = use base template value. Set to false to disable slot for this week.';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_weekly_override_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS weekly_schedule_overrides_updated_at ON weekly_schedule_overrides;
CREATE TRIGGER weekly_schedule_overrides_updated_at
  BEFORE UPDATE ON weekly_schedule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_override_updated_at();
