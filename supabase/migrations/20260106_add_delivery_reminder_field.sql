-- Add delivery day reminder tracking field to parcels table
ALTER TABLE parcels
ADD COLUMN IF NOT EXISTS delivery_reminder_sent_at TIMESTAMPTZ;

-- Add index for querying parcels that need delivery day reminders
-- This helps the edge function efficiently find parcels to send reminders for
CREATE INDEX IF NOT EXISTS idx_parcels_delivery_reminder
ON parcels(delivery_date, delivery_reminder_sent_at)
WHERE selected_slot_id IS NOT NULL AND delivery_reminder_sent_at IS NULL;

-- Comment on new column
COMMENT ON COLUMN parcels.delivery_reminder_sent_at IS 'Timestamp when the delivery day morning reminder email was sent';
