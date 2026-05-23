-- Keep profiles.total_points derived from points_history and assign configured
-- gamification points from database-side events, not only from client code.

UPDATE public.points_history
SET
  type = 'profile_completed',
  reference_id = COALESCE(reference_id, user_id),
  description = COALESCE(NULLIF(description, ''), 'Profilo completato al 100%')
WHERE type = 'profile_complete';

CREATE UNIQUE INDEX IF NOT EXISTS points_history_user_type_reference_key
  ON public.points_history (user_id, type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_configured_user_points(
  p_user_id uuid,
  p_action_type text,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
  v_config_description text;
  v_description text;
  v_points_history_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_action_type IS NULL OR btrim(p_action_type) = '' THEN
    RETURN NULL;
  END IF;

  SELECT pc.points, pc.description
  INTO v_points, v_config_description
  FROM public.points_config pc
  WHERE pc.action_type = p_action_type
    AND pc.is_active = true;

  IF NOT FOUND OR COALESCE(v_points, 0) = 0 THEN
    RETURN NULL;
  END IF;

  v_description := COALESCE(NULLIF(p_description, ''), v_config_description, p_action_type);

  IF p_reference_id IS NOT NULL THEN
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, p_action_type, v_points, p_reference_id, v_description, p_admin_id)
    ON CONFLICT (user_id, type, reference_id)
      WHERE reference_id IS NOT NULL
    DO UPDATE SET
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      admin_id = COALESCE(EXCLUDED.admin_id, public.points_history.admin_id)
    WHERE public.points_history.value IS DISTINCT FROM EXCLUDED.value
       OR public.points_history.description IS DISTINCT FROM EXCLUDED.description
       OR (EXCLUDED.admin_id IS NOT NULL AND public.points_history.admin_id IS DISTINCT FROM EXCLUDED.admin_id)
    RETURNING id INTO v_points_history_id;
  ELSE
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, p_action_type, v_points, NULL, v_description, p_admin_id)
    RETURNING id INTO v_points_history_id;
  END IF;

  RETURN v_points_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.award_configured_user_points(uuid, text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_configured_user_points(uuid, text, uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.award_configured_user_points(uuid, text, uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_configured_user_points(uuid, text, uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.add_user_points(
  p_user_id uuid,
  p_type text,
  p_value integer,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_admin_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reference_id IS NOT NULL THEN
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, p_type, p_value, p_reference_id, p_description, p_admin_id)
    ON CONFLICT (user_id, type, reference_id)
      WHERE reference_id IS NOT NULL
    DO UPDATE SET
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      admin_id = COALESCE(EXCLUDED.admin_id, public.points_history.admin_id)
    WHERE public.points_history.value IS DISTINCT FROM EXCLUDED.value
       OR public.points_history.description IS DISTINCT FROM EXCLUDED.description
       OR (EXCLUDED.admin_id IS NOT NULL AND public.points_history.admin_id IS DISTINCT FROM EXCLUDED.admin_id);
  ELSE
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, p_type, p_value, NULL, p_description, p_admin_id);
  END IF;

  PERFORM public.recalculate_user_total_points(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_badges_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_attended_count int;
  v_badge record;
  v_cat_count int;
  v_marked_attended boolean;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.sport_level, '') LIKE 'manual:%' THEN
    RETURN NEW;
  END IF;

  v_marked_attended := (
    (NEW.checked_in = true AND (OLD.checked_in = false OR OLD.checked_in IS NULL))
    OR (NEW.status = 'attended' AND OLD.status IS DISTINCT FROM NEW.status)
  );

  IF v_marked_attended THEN
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

    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT v_user_id, esb.badge_id
    FROM public.event_special_badges esb
    JOIN public.badges b ON b.id = esb.badge_id
    WHERE esb.event_id = NEW.event_id
      AND b.category = 'special'
      AND b.name <> 'Founding Member'
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_mission_rewards(
  p_user_id uuid,
  p_mission_id uuid,
  p_notify boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $_$
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
$_$;

CREATE OR REPLACE FUNCTION public.sync_event_registration_gamification_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_event_category_id uuid;
  v_attended_count integer;
  v_has_clean_three_event_streak boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.user_id IS NULL OR COALESCE(NEW.sport_level, '') LIKE 'manual:%' THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;

  IF TG_OP = 'UPDATE'
    AND OLD.user_id IS NOT NULL
    AND OLD.user_id IS DISTINCT FROM NEW.user_id
  THEN
    DELETE FROM public.points_history
    WHERE user_id = OLD.user_id
      AND reference_id = NEW.id
      AND type IN (
        'event_registration',
        'event_attended',
        'no_show',
        'late_cancellation'
      );

    PERFORM public.recalculate_user_total_points(OLD.user_id);
  END IF;

  IF NEW.status::text IN ('registered', 'deposit_paid', 'paid', 'attended', 'no_show') THEN
    PERFORM public.award_configured_user_points(
      v_user_id,
      'event_registration',
      NEW.id,
      'Iscrizione ad evento completata'
    );
  END IF;

  IF NEW.status::text = 'no_show' THEN
    PERFORM public.award_configured_user_points(
      v_user_id,
      'no_show',
      NEW.id,
      'Assenza senza preavviso'
    );
  ELSE
    DELETE FROM public.points_history
    WHERE user_id = v_user_id
      AND type = 'no_show'
      AND reference_id = NEW.id;
  END IF;

  IF NEW.status::text = 'cancelled'
    AND COALESCE(NEW.refund_percentage, 100) < 100 THEN
    PERFORM public.award_configured_user_points(
      v_user_id,
      'late_cancellation',
      NEW.id,
      'Cancellazione tardiva'
    );
  ELSE
    DELETE FROM public.points_history
    WHERE user_id = v_user_id
      AND type = 'late_cancellation'
      AND reference_id = NEW.id;
  END IF;

  IF (NEW.checked_in = true OR NEW.status::text = 'attended')
    AND NEW.status::text IN ('registered', 'deposit_paid', 'paid', 'attended') THEN
    PERFORM public.award_configured_user_points(
      v_user_id,
      'event_attended',
      NEW.id,
      'Evento frequentato (check-in)'
    );

    PERFORM public.award_configured_user_points(
      v_user_id,
      'first_event_ever',
      v_user_id,
      'Primo evento in assoluto (bonus)'
    );

    SELECT e.category_id
    INTO v_event_category_id
    FROM public.events e
    WHERE e.id = NEW.event_id;

    IF v_event_category_id IS NOT NULL THEN
      PERFORM public.award_configured_user_points(
        v_user_id,
        'first_event_category',
        v_event_category_id,
        'Primo evento in una nuova categoria'
      );
    END IF;

    v_attended_count := public.count_user_attended_events(v_user_id);

    IF v_attended_count >= 3 THEN
      WITH recent_results AS (
        SELECT er.status::text AS status, er.checked_in
        FROM public.event_registrations er
        JOIN public.events e ON e.id = er.event_id
        WHERE er.user_id = v_user_id
          AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
          AND er.status::text IN ('registered', 'deposit_paid', 'paid', 'attended', 'no_show', 'cancelled')
          AND e.date <= CURRENT_DATE
        ORDER BY e.date DESC, er.created_at DESC
        LIMIT 3
      )
      SELECT count(*) = 3
         AND bool_and((checked_in = true OR status = 'attended') AND status <> 'no_show')
      INTO v_has_clean_three_event_streak
      FROM recent_results;

      IF COALESCE(v_has_clean_three_event_streak, false) THEN
        PERFORM public.award_configured_user_points(
          v_user_id,
          'streak_3',
          v_user_id,
          'Serie di 3 eventi senza cancellazioni'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_event_registration_gamification_points() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_event_registration_gamification_points() FROM anon;
REVOKE ALL ON FUNCTION public.sync_event_registration_gamification_points() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_event_registration_gamification_points() TO service_role;

DROP TRIGGER IF EXISTS trigger_sync_event_registration_gamification_points ON public.event_registrations;
CREATE TRIGGER trigger_sync_event_registration_gamification_points
AFTER INSERT OR UPDATE OF status, checked_in, user_id, sport_level, event_id, refund_percentage ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.sync_event_registration_gamification_points();

CREATE OR REPLACE FUNCTION public.sync_activity_proposal_gamification_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.proposer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.award_configured_user_points(
      NEW.proposer_id,
      'proposal_submitted',
      NEW.id,
      'Proposta attività inviata'
    );
  END IF;

  IF NEW.status = 'converted'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.award_configured_user_points(
      NEW.proposer_id,
      'proposal_approved',
      NEW.id,
      'Proposta attività approvata'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_activity_proposal_gamification_points() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_activity_proposal_gamification_points() FROM anon;
REVOKE ALL ON FUNCTION public.sync_activity_proposal_gamification_points() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_activity_proposal_gamification_points() TO service_role;

DROP TRIGGER IF EXISTS trigger_sync_activity_proposal_gamification_points ON public.activity_proposals;
CREATE TRIGGER trigger_sync_activity_proposal_gamification_points
AFTER INSERT OR UPDATE OF status, proposer_id ON public.activity_proposals
FOR EACH ROW
EXECUTE FUNCTION public.sync_activity_proposal_gamification_points();

CREATE OR REPLACE FUNCTION public.sync_profile_completion_gamification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NULLIF(NEW.first_name, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.last_name, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.phone, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.avatar_url, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.bio, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.self_level, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.trekking_experience, ''), '') <> ''
    AND COALESCE(NULLIF(NEW.activity_frequency, ''), '') <> ''
    AND cardinality(COALESCE(NEW.interests, ARRAY[]::text[])) > 0 THEN
    PERFORM public.award_configured_user_points(
      NEW.id,
      'profile_completed',
      NEW.id,
      'Profilo completato al 100%'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_completion_gamification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_completion_gamification() FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_completion_gamification() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_completion_gamification() TO service_role;

DROP TRIGGER IF EXISTS trigger_sync_profile_completion_gamification ON public.profiles;
CREATE TRIGGER trigger_sync_profile_completion_gamification
AFTER INSERT OR UPDATE OF first_name, last_name, phone, avatar_url, bio, self_level, trekking_experience, activity_frequency, interests ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_completion_gamification();

DO $$
DECLARE
  registration_row record;
  proposal_row record;
  profile_row record;
BEGIN
  FOR registration_row IN
    SELECT er.*, e.category_id
    FROM public.event_registrations er
    LEFT JOIN public.events e ON e.id = er.event_id
    WHERE er.user_id IS NOT NULL
      AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
  LOOP
    IF registration_row.status::text IN ('registered', 'deposit_paid', 'paid', 'attended', 'no_show') THEN
      PERFORM public.award_configured_user_points(
        registration_row.user_id,
        'event_registration',
        registration_row.id,
        'Iscrizione ad evento completata'
      );
    END IF;

    IF registration_row.status::text = 'no_show' THEN
      PERFORM public.award_configured_user_points(
        registration_row.user_id,
        'no_show',
        registration_row.id,
        'Assenza senza preavviso'
      );
    END IF;

    IF registration_row.status::text = 'cancelled'
      AND COALESCE(registration_row.refund_percentage, 100) < 100 THEN
      PERFORM public.award_configured_user_points(
        registration_row.user_id,
        'late_cancellation',
        registration_row.id,
        'Cancellazione tardiva'
      );
    END IF;

    IF (registration_row.checked_in = true OR registration_row.status::text = 'attended')
      AND registration_row.status::text IN ('registered', 'deposit_paid', 'paid', 'attended') THEN
      PERFORM public.award_configured_user_points(
        registration_row.user_id,
        'event_attended',
        registration_row.id,
        'Evento frequentato (check-in)'
      );

      PERFORM public.award_configured_user_points(
        registration_row.user_id,
        'first_event_ever',
        registration_row.user_id,
        'Primo evento in assoluto (bonus)'
      );

      IF registration_row.category_id IS NOT NULL THEN
        PERFORM public.award_configured_user_points(
          registration_row.user_id,
          'first_event_category',
          registration_row.category_id,
          'Primo evento in una nuova categoria'
        );
      END IF;
    END IF;
  END LOOP;

  FOR proposal_row IN
    SELECT id, proposer_id, status
    FROM public.activity_proposals
    WHERE proposer_id IS NOT NULL
  LOOP
    PERFORM public.award_configured_user_points(
      proposal_row.proposer_id,
      'proposal_submitted',
      proposal_row.id,
      'Proposta attività inviata'
    );

    IF proposal_row.status = 'converted' THEN
      PERFORM public.award_configured_user_points(
        proposal_row.proposer_id,
        'proposal_approved',
        proposal_row.id,
        'Proposta attività approvata'
      );
    END IF;
  END LOOP;

  FOR profile_row IN
    SELECT id
    FROM public.profiles
    WHERE COALESCE(NULLIF(first_name, ''), '') <> ''
      AND COALESCE(NULLIF(last_name, ''), '') <> ''
      AND COALESCE(NULLIF(phone, ''), '') <> ''
      AND COALESCE(NULLIF(avatar_url, ''), '') <> ''
      AND COALESCE(NULLIF(bio, ''), '') <> ''
      AND COALESCE(NULLIF(self_level, ''), '') <> ''
      AND COALESCE(NULLIF(trekking_experience, ''), '') <> ''
      AND COALESCE(NULLIF(activity_frequency, ''), '') <> ''
      AND cardinality(COALESCE(interests, ARRAY[]::text[])) > 0
  LOOP
    PERFORM public.award_configured_user_points(
      profile_row.id,
      'profile_completed',
      profile_row.id,
      'Profilo completato al 100%'
    );
  END LOOP;
END;
$$;

UPDATE public.profiles p
SET
  total_points = totals.total_points,
  updated_at = now()
FROM (
  SELECT
    p_inner.id,
    COALESCE(SUM(ph.value), 0)::integer AS total_points
  FROM public.profiles p_inner
  LEFT JOIN public.points_history ph ON ph.user_id = p_inner.id
  GROUP BY p_inner.id
) totals
WHERE p.id = totals.id
  AND p.total_points IS DISTINCT FROM totals.total_points;
