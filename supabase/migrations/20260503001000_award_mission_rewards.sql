ALTER TABLE public.user_rewards
  ADD COLUMN IF NOT EXISTS source_mission_reward_id uuid REFERENCES public.mission_rewards(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_rewards_user_source_mission_reward_key
  ON public.user_rewards (user_id, source_mission_reward_id)
  WHERE source_mission_reward_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS points_history_user_mission_reward_key
  ON public.points_history (user_id, type, reference_id)
  WHERE type = 'mission_reward' AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_mission_rewards(
  p_user_id uuid,
  p_mission_id uuid,
  p_notify boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reward_row record;
  mission_title text;
  badge_name text;
  coupon_id uuid;
  coupon_code text;
  coupon_prefix text;
  coupon_type text;
  coupon_value numeric;
  coupon_expires_at timestamptz;
  coupon_validity_days integer;
  inserted_id uuid;
  awarded_count integer := 0;
  reward_parts text[] := ARRAY[]::text[];
  v_reward_details jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR p_mission_id IS NULL THEN
    RETURN jsonb_build_object('awarded_count', 0, 'rewards', '[]'::jsonb);
  END IF;

  SELECT title INTO mission_title
  FROM public.missions
  WHERE id = p_mission_id;

  FOR reward_row IN
    SELECT mr.*
    FROM public.mission_rewards mr
    WHERE mr.mission_id = p_mission_id
    ORDER BY mr.sort_order ASC, mr.created_at ASC
  LOOP
    inserted_id := NULL;
    badge_name := NULL;
    coupon_id := NULL;
    coupon_code := NULL;

    IF reward_row.reward_kind = 'points' AND coalesce(reward_row.points_value, 0) > 0 THEN
      INSERT INTO public.points_history (user_id, type, value, description, reference_id)
      VALUES (
        p_user_id,
        'mission_reward',
        reward_row.points_value,
        coalesce(nullif(reward_row.title, ''), 'Ricompensa missione: ' || coalesce(mission_title, 'Missione')),
        reward_row.id
      )
      ON CONFLICT (user_id, type, reference_id)
        WHERE type = 'mission_reward' AND reference_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_id;

      IF inserted_id IS NOT NULL THEN
        UPDATE public.profiles
        SET total_points = coalesce(total_points, 0) + reward_row.points_value,
            updated_at = now()
        WHERE id = p_user_id;

        INSERT INTO public.user_rewards (
          user_id,
          mission_id,
          source_mission_reward_id,
          type,
          title,
          value,
          status
        )
        VALUES (
          p_user_id,
          p_mission_id,
          reward_row.id,
          'points',
          '+' || reward_row.points_value::text || ' punti',
          reward_row.points_value::text,
          'active'
        )
        ON CONFLICT (user_id, source_mission_reward_id)
          WHERE source_mission_reward_id IS NOT NULL
        DO NOTHING;

        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, '+' || reward_row.points_value::text || ' punti');
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'points',
          'points', reward_row.points_value,
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    ELSIF reward_row.reward_kind = 'badge' AND reward_row.badge_id IS NOT NULL THEN
      SELECT name INTO badge_name
      FROM public.badges
      WHERE id = reward_row.badge_id;

      INSERT INTO public.user_badges (user_id, badge_id, completed, completed_at, progress)
      VALUES (p_user_id, reward_row.badge_id, true, now(), 100)
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING id INTO inserted_id;

      INSERT INTO public.user_rewards (
        user_id,
        mission_id,
        source_mission_reward_id,
        type,
        title,
        value,
        status
      )
      VALUES (
        p_user_id,
        p_mission_id,
        reward_row.id,
        'badge',
        coalesce(nullif(reward_row.title, ''), badge_name, 'Badge missione'),
        badge_name,
        'active'
      )
      ON CONFLICT (user_id, source_mission_reward_id)
        WHERE source_mission_reward_id IS NOT NULL
      DO NOTHING;

      IF inserted_id IS NOT NULL THEN
        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, 'badge ' || coalesce(badge_name, 'missione'));
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'badge',
          'badge_id', reward_row.badge_id,
          'badge_name', badge_name,
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    ELSIF reward_row.reward_kind = 'coupon' THEN
      SELECT dc.discount_type, dc.discount_value, dc.expires_at
      INTO coupon_type, coupon_value, coupon_expires_at
      FROM public.discount_codes dc
      WHERE dc.id = reward_row.source_discount_code_id;

      IF coupon_type IS NULL THEN
        coupon_type := lower(coalesce(reward_row.coupon_config ->> 'discount_type', 'percentage'));
        IF coupon_type NOT IN ('percentage', 'fixed') THEN
          coupon_type := 'percentage';
        END IF;

        coupon_value := CASE
          WHEN coalesce(reward_row.coupon_config ->> 'discount_value', '') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (reward_row.coupon_config ->> 'discount_value')::numeric
          ELSE 10
        END;

        coupon_validity_days := CASE
          WHEN coalesce(reward_row.coupon_config ->> 'validity_days', '') ~ '^[0-9]+$'
            THEN (reward_row.coupon_config ->> 'validity_days')::integer
          ELSE NULL
        END;

        coupon_expires_at := CASE
          WHEN coupon_validity_days IS NOT NULL THEN now() + make_interval(days => coupon_validity_days)
          ELSE NULL
        END;
      END IF;

      coupon_prefix := upper(regexp_replace(coalesce(nullif(reward_row.coupon_config ->> 'code_prefix', ''), 'MISSION'), '[^A-Z0-9_-]', '', 'g'));
      IF coupon_prefix = '' THEN
        coupon_prefix := 'MISSION';
      END IF;
      coupon_code := coupon_prefix || '-' || upper(substr(md5(p_user_id::text || reward_row.id::text), 1, 8));

      INSERT INTO public.discount_codes (
        code,
        description,
        discount_type,
        discount_value,
        applies_to_all,
        max_uses,
        expires_at,
        is_active,
        assigned_user_id,
        is_single_use
      )
      VALUES (
        coupon_code,
        coalesce(nullif(reward_row.title, ''), 'Ricompensa missione: ' || coalesce(mission_title, 'Missione')),
        coupon_type,
        greatest(coalesce(coupon_value, 10), 0.01),
        true,
        1,
        coupon_expires_at,
        true,
        p_user_id,
        true
      )
      ON CONFLICT (code) DO UPDATE
        SET updated_at = public.discount_codes.updated_at
      RETURNING id, code INTO coupon_id, coupon_code;

      INSERT INTO public.user_rewards (
        user_id,
        mission_id,
        source_mission_reward_id,
        type,
        title,
        value,
        status,
        expiry_date
      )
      VALUES (
        p_user_id,
        p_mission_id,
        reward_row.id,
        'coupon',
        coalesce(nullif(reward_row.title, ''), 'Sconto missione'),
        coupon_code,
        'active',
        coupon_expires_at
      )
      ON CONFLICT (user_id, source_mission_reward_id)
        WHERE source_mission_reward_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_id;

      IF inserted_id IS NOT NULL THEN
        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, 'uno sconto');
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'coupon',
          'discount_code_id', coupon_id,
          'code', coupon_code,
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    ELSIF reward_row.reward_kind = 'physical' THEN
      INSERT INTO public.user_rewards (
        user_id,
        mission_id,
        source_mission_reward_id,
        type,
        title,
        value,
        status
      )
      VALUES (
        p_user_id,
        p_mission_id,
        reward_row.id,
        'physical',
        coalesce(nullif(reward_row.title, ''), 'Premio missione'),
        null,
        CASE WHEN coalesce(reward_row.approval_required, false) THEN 'pending' ELSE 'active' END
      )
      ON CONFLICT (user_id, source_mission_reward_id)
        WHERE source_mission_reward_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_id;

      IF inserted_id IS NOT NULL THEN
        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, coalesce(nullif(reward_row.title, ''), 'un premio'));
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'physical',
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    END IF;
  END LOOP;

  UPDATE public.user_missions
  SET reward_details = CASE
        WHEN public.user_missions.reward_details IS NULL THEN jsonb_build_object('awarded_rewards', v_reward_details)
        ELSE public.user_missions.reward_details || jsonb_build_object('awarded_rewards', v_reward_details)
      END
  WHERE user_id = p_user_id
    AND mission_id = p_mission_id
    AND awarded_count > 0;

  IF p_notify AND awarded_count > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      p_user_id,
      'Missione completata',
      'Hai sbloccato ' || array_to_string(reward_parts, ', ') || '.',
      'success'
    );
  END IF;

  RETURN jsonb_build_object('awarded_count', awarded_count, 'rewards', v_reward_details);
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

    IF completed_flag THEN
      PERFORM public.award_mission_rewards(p_user_id, mission_row.id, true);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  completed_mission record;
BEGIN
  FOR completed_mission IN
    SELECT user_id, mission_id
    FROM public.user_missions
    WHERE completed = true
  LOOP
    PERFORM public.award_mission_rewards(completed_mission.user_id, completed_mission.mission_id, false);
  END LOOP;
END;
$$;
