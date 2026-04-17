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

-- Add comment
COMMENT ON FUNCTION generate_secret_token() IS 'Generates URL-safe base64 token for parcel slot selection links';