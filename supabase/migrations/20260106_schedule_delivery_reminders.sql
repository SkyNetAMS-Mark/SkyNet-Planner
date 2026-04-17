-- Schedule delivery day reminder emails
--
-- Since pg_cron is not available on Supabase Free tier, use one of these alternatives:
--
-- Option 1: Supabase Dashboard Cron (if available)
--   Go to Database > Extensions > Enable pg_cron
--   Then create a cron job in the SQL editor
--
-- Option 2: External Scheduler (Recommended for Free tier)
--   Use Vercel Cron, GitHub Actions, or any external service to call:
--   POST https://your-app.com/api/send-delivery-reminder
--   Body: { "sendAll": true }
--   Schedule: Daily at 7:00 AM Amsterdam time
--
-- Option 3: Manual Trigger
--   Use the "Today's Reminders" button in the admin parcels page
--
-- This migration only adds documentation, no actual cron job is created.

COMMENT ON TABLE parcels IS 'Parcels table with delivery reminder tracking.
Use delivery_reminder_sent_at to track when day-of-delivery emails were sent.
Trigger reminders via: POST /api/send-delivery-reminder with { "sendAll": true }';
