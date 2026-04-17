-- Make delivery_date nullable in parcels table
-- Run this in Supabase SQL Editor

ALTER TABLE parcels 
ALTER COLUMN delivery_date DROP NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'delivery_date is now nullable!';
  RAISE NOTICE 'Parcels can be uploaded without delivery dates';
  RAISE NOTICE 'Delivery date will be set when customer selects slot';
END $$;