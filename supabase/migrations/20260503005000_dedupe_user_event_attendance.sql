CREATE OR REPLACE FUNCTION public.count_user_attended_events(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(DISTINCT er.event_id)::integer
  FROM public.event_registrations er
  WHERE er.user_id = p_user_id
    AND er.event_id IS NOT NULL
    AND (er.checked_in = true OR er.status = 'attended')
    AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended');
$$;

CREATE OR REPLACE FUNCTION public.count_user_attended_events_in_category(
  p_user_id uuid,
  p_category text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(DISTINCT er.event_id)::integer
  FROM public.event_registrations er
  JOIN public.events e ON e.id = er.event_id
  JOIN public.event_categories ec ON ec.id = e.category_id
  WHERE er.user_id = p_user_id
    AND er.event_id IS NOT NULL
    AND (er.checked_in = true OR er.status = 'attended')
    AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
    AND ec.name = p_category;
$$;

CREATE OR REPLACE FUNCTION public.award_badges_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_attended_count int;
  v_badge record;
  v_cat_count int;
BEGIN
  IF NEW.checked_in = true AND (OLD.checked_in = false OR OLD.checked_in IS NULL) THEN
    v_user_id := NEW.user_id;
    v_attended_count := public.count_user_attended_events(v_user_id);

    FOR v_badge IN
      SELECT id
      FROM public.badges
      WHERE category IS NULL
        AND required_events <= v_attended_count
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (v_user_id, v_badge.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END LOOP;

    IF v_attended_count >= 5 THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      SELECT v_user_id, id
      FROM public.badges
      WHERE name = 'Scampagnatore Ufficiale'
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

    FOR v_badge IN
      SELECT b.id, b.category, b.required_events
      FROM public.badges b
      WHERE b.category IS NOT NULL
        AND b.category != 'special'
    LOOP
      v_cat_count := public.count_user_attended_events_in_category(v_user_id, v_badge.category);

      IF v_cat_count >= v_badge.required_events THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (v_user_id, v_badge.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END LOOP;

    UPDATE public.profiles
    SET total_points = greatest(coalesce(total_points, 0), v_attended_count)
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
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
      CASE WHEN completed_flag THEN 'completed' ELSE 'active' END,
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
      state = EXCLUDED.state,
      legacy_user_mission_id = EXCLUDED.legacy_user_mission_id;

    IF completed_flag THEN
      PERFORM public.award_mission_rewards(p_user_id, mission_row.id, true);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  affected_user record;
BEGIN
  FOR affected_user IN
    SELECT DISTINCT user_id
    FROM public.event_registrations
    WHERE (checked_in = true OR status = 'attended')
  LOOP
    PERFORM public.sync_user_missions_for_user(affected_user.user_id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_user_attended_events(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_user_attended_events_in_category(uuid, text) FROM PUBLIC, anon, authenticated;
