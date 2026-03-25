-- 053: Schedule sync_flightaware_daily() via pg_cron
-- Runs daily at 03:00 UTC (covers most timezones' "overnight" window)
-- Requires pg_cron extension enabled in Supabase project settings
-- To apply: run this migration after enabling pg_cron in Supabase dashboard
-- To verify: SELECT * FROM cron.job WHERE jobname = 'flightaware-daily-sync';
-- To manually trigger: SELECT sync_flightaware_daily();
-- To disable: SELECT cron.unschedule('flightaware-daily-sync');

-- Enable pg_cron extension (idempotent — safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove existing job with same name before re-adding (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flightaware-daily-sync') THEN
    PERFORM cron.unschedule('flightaware-daily-sync');
  END IF;
END $$;

-- Schedule the daily sync at 03:00 UTC every day
SELECT cron.schedule(
  'flightaware-daily-sync',           -- job name
  '0 3 * * *',                        -- 03:00 UTC every day
  $$SELECT sync_flightaware_daily()$$ -- SQL to execute
);
