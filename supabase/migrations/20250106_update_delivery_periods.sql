-- Update delivery periods to new time windows
-- Old: Morning (08:00-12:00), Afternoon (12:00-17:00), Evening (17:00-21:00)
-- New: Morning (09:00-13:00), Midday (12:00-16:00), Afternoon (14:00-18:00)

-- First, update existing periods or insert new ones
-- We'll use upsert logic to handle both cases

-- Update Morning period
UPDATE delivery_periods
SET
  start_time = '09:00:00',
  end_time = '13:00:00',
  sort_order = 1,
  updated_at = NOW()
WHERE name = 'Morning';

-- If Morning doesn't exist, insert it
INSERT INTO delivery_periods (name, start_time, end_time, sort_order, is_active)
SELECT 'Morning', '09:00:00', '13:00:00', 1, true
WHERE NOT EXISTS (SELECT 1 FROM delivery_periods WHERE name = 'Morning');

-- Update or insert Midday period (was possibly Afternoon before)
UPDATE delivery_periods
SET
  name = 'Midday',
  start_time = '12:00:00',
  end_time = '16:00:00',
  sort_order = 2,
  updated_at = NOW()
WHERE name = 'Afternoon' AND NOT EXISTS (SELECT 1 FROM delivery_periods WHERE name = 'Midday');

-- If no existing period to update, insert Midday
INSERT INTO delivery_periods (name, start_time, end_time, sort_order, is_active)
SELECT 'Midday', '12:00:00', '16:00:00', 2, true
WHERE NOT EXISTS (SELECT 1 FROM delivery_periods WHERE name = 'Midday');

-- Insert or update Afternoon period (new times)
INSERT INTO delivery_periods (name, start_time, end_time, sort_order, is_active)
VALUES ('Afternoon', '14:00:00', '18:00:00', 3, true)
ON CONFLICT (name) DO UPDATE SET
  start_time = '14:00:00',
  end_time = '18:00:00',
  sort_order = 3,
  updated_at = NOW();

-- Deactivate Evening period if it exists (no longer used)
UPDATE delivery_periods
SET is_active = false, updated_at = NOW()
WHERE name = 'Evening';

-- Verify the result
-- SELECT name, start_time, end_time, sort_order, is_active FROM delivery_periods ORDER BY sort_order;
