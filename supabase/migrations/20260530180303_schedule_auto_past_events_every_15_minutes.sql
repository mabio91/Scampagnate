DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'auto-past-events';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'auto-past-events',
  '*/15 * * * *',
  $$ SELECT public.invoke_scampagnate_edge_function('auto-past-events', '{}'::jsonb); $$
);
