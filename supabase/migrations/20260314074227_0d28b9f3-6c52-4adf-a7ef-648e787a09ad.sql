
-- Drop existing cron job
SELECT cron.unschedule('event-reminder-hourly');

-- Create 24h reminder cron job (runs every hour)
SELECT cron.schedule(
  'event-reminder-24h',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://etiynvukviykquqcsjln.supabase.co/functions/v1/event-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI"}'::jsonb,
    body := '{"reminder_type": "24h"}'::jsonb
  ) AS request_id;
  $$
);

-- Create 3h reminder cron job (runs every hour)
SELECT cron.schedule(
  'event-reminder-3h',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://etiynvukviykquqcsjln.supabase.co/functions/v1/event-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI"}'::jsonb,
    body := '{"reminder_type": "3h"}'::jsonb
  ) AS request_id;
  $$
);
