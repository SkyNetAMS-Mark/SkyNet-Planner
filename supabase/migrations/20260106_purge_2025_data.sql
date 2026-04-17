-- Purge old test data from 2025
-- This removes all parcels, parcel_history, and related data created before 2026

-- First delete parcel history (depends on parcels)
DELETE FROM parcel_history
WHERE parcel_id IN (
  SELECT id FROM parcels WHERE created_at < '2026-01-01'
);

-- Delete old parcels
DELETE FROM parcels WHERE created_at < '2026-01-01';

-- Note: We keep senders, drivers, regions, schedules, routes, and postal_code_ranges
-- as they are configuration data, not transactional data

-- Output summary
DO $$
BEGIN
  RAISE NOTICE 'Purge complete. Old 2025 data has been removed.';
END $$;
