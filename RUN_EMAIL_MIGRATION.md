# Database Migrations for Email System

## Run These SQL Scripts in Supabase

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/gcinrqwfecwdrphzhgiy
2. Click on "SQL Editor" in the left sidebar
3. Run each migration below in order

### Migration 1: Email Tracking Fields

Click "New Query" and run:

```sql
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
```

### Migration 2: Fix URL-Safe Tokens

Click "New Query" and run:

```sql
-- Fix token generation to use URL-safe base64 encoding
-- This replaces + with - and / with _ and removes = padding

CREATE OR REPLACE FUNCTION generate_secret_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate URL-safe base64: replace + with -, / with _, remove =
  RETURN translate(
    rtrim(encode(gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );
END;
$$;

-- Update existing parcels with URL-safe tokens
-- Only update parcels that haven't been used yet
UPDATE parcels
SET secret_token = translate(
  rtrim(encode(gen_random_bytes(32), 'base64'), '='),
  '+/',
  '-_'
)
WHERE token_used = false
AND (secret_token LIKE '%/%' OR secret_token LIKE '%+%' OR secret_token LIKE '%=%');
```

Click "Run" button for each migration.

## What These Migrations Do

### Migration 1:
- Adds `invite_sent_at` - Tracks when the initial invite email was sent
- Adds `reminder_sent_at` - Tracks when the last reminder was sent
- Adds `reminder_count` - Counts how many reminders have been sent

### Migration 2:
- Fixes token generation to use URL-safe base64 (no `/`, `+`, or `=` characters)
- Updates existing unused tokens to be URL-safe
- Prevents 404 errors on slot selection links

## After Running Both Migrations

- ✅ Email buttons will work correctly
- ✅ All slot selection links will work (no more 404 errors)
- ✅ New parcels will get URL-safe tokens automatically