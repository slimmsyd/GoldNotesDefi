-- =====================================================
-- Auto-Verify Webhook Trigger
-- =====================================================
-- This migration sets up a database trigger on goldback_serials
-- that automatically calls the auto-verify API endpoint
-- when new serial numbers are inserted.
--
-- Uses Supabase's built-in pg_net extension for HTTP requests.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
--
-- IMPORTANT: Update the WEBHOOK_URL and WEBHOOK_SECRET below
-- to match your deployment.
-- =====================================================

-- Enable pg_net extension (HTTP requests from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =====================================================
-- Configuration: UPDATE THESE VALUES
-- =====================================================
-- For local development:
--   WEBHOOK_URL = 'http://localhost:3000/api/admin/auto-verify'
-- For Vercel deployment:
--   WEBHOOK_URL = 'https://your-app.vercel.app/api/admin/auto-verify'
-- =====================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION notify_auto_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_url TEXT := 'http://localhost:3000/api/admin/auto-verify';
  webhook_secret TEXT := 'REPLACE_WITH_SECURE_WEBHOOK_SECRET';
BEGIN
  -- Use pg_net to make an async HTTP POST request
  -- This is non-blocking and won't slow down the INSERT
  -- Note: We don't send specific record data because the API
  -- fetches ALL serials and recomputes the full merkle root anyway.
  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'goldback_serials',
      'triggered_at', now()::text
    )
  );

  RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS auto_verify_on_serial_insert ON goldback_serials;

-- Create the trigger
-- AFTER INSERT: runs after the row is committed
-- FOR EACH STATEMENT: runs once per batch insert (not per row)
-- This prevents firing 100 webhooks for a 100-row batch insert
CREATE TRIGGER auto_verify_on_serial_insert
  AFTER INSERT ON goldback_serials
  FOR EACH STATEMENT
  EXECUTE FUNCTION notify_auto_verify();

-- Verify the trigger was created
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'goldback_serials';

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. FOR EACH STATEMENT fires once per INSERT statement,
--    even if multiple rows are inserted. The auto-verify
--    API has a built-in 5s debounce for webhook triggers.
--
-- 2. pg_net requests are async (fire-and-forget).
--    If the API endpoint is down, the insert still succeeds.
--
-- 3. To disable auto-verification temporarily:
--    ALTER TABLE goldback_serials DISABLE TRIGGER auto_verify_on_serial_insert;
--
-- 4. To re-enable:
--    ALTER TABLE goldback_serials ENABLE TRIGGER auto_verify_on_serial_insert;
--
-- 5. To check pg_net request history:
--    SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
-- =====================================================
