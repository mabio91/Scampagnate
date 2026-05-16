CREATE OR REPLACE FUNCTION public.compute_mission_cycle_key(
  p_mission_type text,
  p_timezone text DEFAULT 'Europe/Rome'
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(coalesce(p_mission_type, ''))
    WHEN 'monthly' THEN to_char((timezone(coalesce(nullif(p_timezone, ''), 'Europe/Rome'), now()))::date, 'YYYY-MM')
    WHEN 'weekly' THEN to_char((timezone(coalesce(nullif(p_timezone, ''), 'Europe/Rome'), now()))::date, 'IYYY-"W"IW')
    ELSE 'lifetime'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_missions_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      mc.event_filters
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
      SELECT count(*)::integer
      INTO progress_count
      FROM public.event_registrations er
      WHERE er.user_id = p_user_id
        AND er.checked_in = true
        AND coalesce(er.sport_level, '') NOT LIKE 'manual:%';
    ELSIF mission_row.target_action IN ('event_attended', 'event_attendance', 'category_participation') THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      JOIN public.events e ON e.id = er.event_id
      LEFT JOIN public.event_categories ec ON ec.id = e.category_id
      WHERE er.user_id = p_user_id
        AND er.checked_in = true
        AND coalesce(er.sport_level, '') NOT LIKE 'manual:%'
        AND (
          CASE lower(coalesce(mission_row.type, ''))
            WHEN 'monthly' THEN to_char(e.date, 'YYYY-MM') = cycle_key_value
            WHEN 'weekly' THEN to_char(e.date, 'IYYY-"W"IW') = cycle_key_value
            ELSE true
          END
        )
        AND (
          mission_row.target_action <> 'category_participation'
          OR (
            (
              coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)), 0) = 0
              AND coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)), 0) = 0
              AND coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '') = ''
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
        WHEN EXCLUDED.completed THEN coalesce(public.user_missions.completed_at, now())
        ELSE NULL
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
      completed_at = CASE
        WHEN EXCLUDED.is_completed THEN coalesce(public.user_mission_progress.completed_at, now())
        ELSE NULL
      END,
      last_progress_at = now(),
      cycle_started_at = coalesce(public.user_mission_progress.cycle_started_at, EXCLUDED.cycle_started_at),
      cycle_ends_at = EXCLUDED.cycle_ends_at,
      legacy_user_mission_id = EXCLUDED.legacy_user_mission_id,
      updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_registration_mission_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_user_missions_for_user(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_user_missions_for_user(NEW.user_id);

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    PERFORM public.sync_user_missions_for_user(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_user_missions_on_registration ON public.event_registrations;
CREATE TRIGGER trigger_sync_user_missions_on_registration
AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.handle_registration_mission_sync();

DO $$
DECLARE
  affected_user record;
BEGIN
  FOR affected_user IN
    SELECT DISTINCT user_id
    FROM public.event_registrations
    WHERE coalesce(sport_level, '') NOT LIKE 'manual:%'
  LOOP
    PERFORM public.sync_user_missions_for_user(affected_user.user_id);
  END LOOP;
END;
$$;
