-- Add email tracking fields to parcels table
ALTER TABLE parcels 
ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- Add index for querying parcels that need invites
CREATE INDEX IF NOT EXISTS idx_parcels_invite_sent ON parcels(invite_sent_at) WHERE invite_sent_at IS NULL;

-- Add index for querying parcels that need reminders
CREATE INDEX IF NOT EXISTS idx_parcels_reminder_sent ON parcels(reminder_sent_at);

-- Comment on new columns
COMMENT ON COLUMN parcels.invite_sent_at IS 'Timestamp when the initial slot selection invite email was sent';
COMMENT ON COLUMN parcels.reminder_sent_at IS 'Timestamp when the last reminder email was sent';
COMMENT ON COLUMN parcels.reminder_count IS 'Number of reminder emails sent for this parcel';