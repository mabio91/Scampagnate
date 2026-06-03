CREATE OR REPLACE FUNCTION public.sync_user_missions_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_row record;
  progress_count integer;
  capped_progress integer;
  completed_flag boolean;
  cycle_key_value text;
  progress_row_id uuid;
  cycle_start_value timestamptz;
  cycle_end_value timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR mission_row IN
    SELECT
      m.id,
      m.type,
      m.title,
      m.target_value,
      m.target_action,
      m.category,
      m.category_filter,
      coalesce(nullif(m.timezone, ''), 'Europe/Rome') AS timezone,
      coalesce(mc.event_filters, '{}'::jsonb) AS event_filters
    FROM public.missions m
    LEFT JOIN LATERAL (
      SELECT event_filters
      FROM public.mission_conditions
      WHERE mission_id = m.id
      ORDER BY sort_order ASC
      LIMIT 1
    ) mc ON true
    WHERE m.is_active = true
      AND coalesce(m.is_archived, false) = false
      AND coalesce(m.status, 'active') NOT IN ('archived', 'draft')
    ORDER BY m.sort_order ASC, m.created_at ASC
  LOOP
    cycle_key_value := public.compute_mission_cycle_key(mission_row.type, mission_row.timezone);

    cycle_start_value := CASE lower(coalesce(mission_row.type, ''))
      WHEN 'monthly' THEN date_trunc('month', timezone(mission_row.timezone, now())) AT TIME ZONE mission_row.timezone
      WHEN 'weekly' THEN date_trunc('week', timezone(mission_row.timezone, now())) AT TIME ZONE mission_row.timezone
      ELSE now()
    END;

    cycle_end_value := CASE lower(coalesce(mission_row.type, ''))
      WHEN 'monthly' THEN (date_trunc('month', timezone(mission_row.timezone, now())) + interval '1 month') AT TIME ZONE mission_row.timezone
      WHEN 'weekly' THEN (date_trunc('week', timezone(mission_row.timezone, now())) + interval '1 week') AT TIME ZONE mission_row.timezone
      ELSE NULL
    END;

    IF mission_row.target_action = 'first_event_ever' THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      WHERE er.user_id = p_user_id
        AND er.event_id IS NOT NULL
        AND (er.checked_in = true OR er.status = 'attended')
        AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended');
    ELSIF mission_row.target_action IN ('event_attended', 'event_attendance', 'category_participation') THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      JOIN public.events e ON e.id = er.event_id
      LEFT JOIN public.event_categories ec ON ec.id = e.category_id
      WHERE er.user_id = p_user_id
        AND er.event_id IS NOT NULL
        AND (er.checked_in = true OR er.status = 'attended')
        AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
        AND (
          CASE lower(coalesce(mission_row.type, ''))
            WHEN 'monthly' THEN to_char(e.date, 'YYYY-MM') = cycle_key_value
            WHEN 'weekly' THEN to_char(e.date, 'IYYY-"W"IW') = cycle_key_value
            ELSE true
          END
        )
        AND (
          (
            coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)), 0) = 0
            AND coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)), 0) = 0
            AND coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '') = ''
            AND coalesce(array_length(mission_row.category_filter, 1), 0) = 0
          )
          OR ec.id IN (
            SELECT value::uuid
            FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)) AS value
          )
          OR ec.name IN (
            SELECT value
            FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)) AS value
          )
          OR ec.name = coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '')
          OR ec.name = ANY(coalesce(mission_row.category_filter, ARRAY[]::text[]))
        )
        AND (
          coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'secondary_category_names', '[]'::jsonb)), 0) = 0
          OR e.additional_fields ->> 'fit_score_main_category' IN (
            SELECT value
            FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'secondary_category_names', '[]'::jsonb)) AS value
          )
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(coalesce(e.additional_fields -> 'fit_score_secondary_categories', '[]'::jsonb)) AS event_secondary(value)
            WHERE event_secondary.value IN (
              SELECT value
              FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'secondary_category_names', '[]'::jsonb)) AS selected_secondary(value)
            )
          )
        );
    ELSE
      progress_count := 0;
    END IF;

    capped_progress := least(coalesce(progress_count, 0), greatest(coalesce(mission_row.target_value, 1), 1));
    completed_flag := capped_progress >= greatest(coalesce(mission_row.target_value, 1), 1);

    INSERT INTO public.user_missions (
      user_id,
      mission_id,
      progress,
      completed,
      completed_at,
      reward_details
    )
    VALUES (
      p_user_id,
      mission_row.id,
      capped_progress,
      completed_flag,
      CASE WHEN completed_flag THEN now() ELSE NULL END,
      NULL
    )
    ON CONFLICT (user_id, mission_id)
    DO UPDATE SET
      progress = EXCLUDED.progress,
      completed = EXCLUDED.completed,
      completed_at = CASE
        WHEN NOT EXCLUDED.completed THEN NULL
        WHEN lower(coalesce(mission_row.type, '')) IN ('monthly', 'weekly') THEN
          CASE
            WHEN public.user_missions.completed_at >= cycle_start_value
              AND (cycle_end_value IS NULL OR public.user_missions.completed_at < cycle_end_value)
            THEN public.user_missions.completed_at
            ELSE now()
          END
        ELSE coalesce(public.user_missions.completed_at, now())
      END
    RETURNING id INTO progress_row_id;

    INSERT INTO public.user_mission_progress (
      user_id,
      mission_id,
      cycle_key,
      current_value,
      target_value,
      completion_count,
      is_completed,
      is_locked,
      is_expired,
      started_at,
      completed_at,
      last_progress_at,
      cycle_started_at,
      cycle_ends_at,
      state,
      legacy_user_mission_id
    )
    VALUES (
      p_user_id,
      mission_row.id,
      cycle_key_value,
      capped_progress,
      greatest(coalesce(mission_row.target_value, 1), 1),
      CASE WHEN completed_flag THEN 1 ELSE 0 END,
      completed_flag,
      false,
      false,
      now(),
      CASE WHEN completed_flag THEN now() ELSE NULL END,
      now(),
      cycle_start_value,
      cycle_end_value,
      '{}'::jsonb,
      progress_row_id
    )
    ON CONFLICT (user_id, mission_id, cycle_key)
    DO UPDATE SET
      current_value = EXCLUDED.current_value,
      target_value = EXCLUDED.target_value,
      completion_count = EXCLUDED.completion_count,
      is_completed = EXCLUDED.is_completed,
      is_locked = false,
      is_expired = false,
      completed_at = CASE
        WHEN EXCLUDED.is_completed THEN coalesce(public.user_mission_progress.completed_at, now())
        ELSE NULL
      END,
      last_progress_at = now(),
      cycle_started_at = coalesce(public.user_mission_progress.cycle_started_at, EXCLUDED.cycle_started_at),
      cycle_ends_at = EXCLUDED.cycle_ends_at,
      legacy_user_mission_id = EXCLUDED.legacy_user_mission_id,
      updated_at = now();

    IF completed_flag THEN
      PERFORM public.award_mission_rewards(p_user_id, mission_row.id, true);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_current_periodic_user_missions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_user record;
  synced_count integer := 0;
BEGIN
  FOR affected_user IN
    SELECT DISTINCT user_id
    FROM (
      SELECT er.user_id
      FROM public.event_registrations er
      WHERE er.user_id IS NOT NULL
        AND coalesce(er.sport_level, '') NOT LIKE 'manual:%'

      UNION

      SELECT um.user_id
      FROM public.user_missions um
      JOIN public.missions m ON m.id = um.mission_id
      WHERE lower(coalesce(m.type, '')) IN ('monthly', 'weekly')
        AND m.is_active = true
        AND coalesce(m.is_archived, false) = false
        AND coalesce(m.status, 'active') NOT IN ('archived', 'draft')

      UNION

      SELECT ump.user_id
      FROM public.user_mission_progress ump
      JOIN public.missions m ON m.id = ump.mission_id
      WHERE lower(coalesce(m.type, '')) IN ('monthly', 'weekly')
        AND m.is_active = true
        AND coalesce(m.is_archived, false) = false
        AND coalesce(m.status, 'active') NOT IN ('archived', 'draft')
    ) users
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_missions_for_user(affected_user.user_id);
    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_current_periodic_user_missions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_current_periodic_user_missions() FROM anon;
REVOKE ALL ON FUNCTION public.sync_current_periodic_user_missions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_current_periodic_user_missions() TO service_role;

DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sync-current-periodic-user-missions';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'sync-current-periodic-user-missions',
  '5 * * * *',
  $$ SELECT public.sync_current_periodic_user_missions(); $$
);

SELECT public.sync_current_periodic_user_missions();
