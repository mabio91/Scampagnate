ALTER TABLE public.badges
ADD COLUMN IF NOT EXISTS event_filters jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.badges
SET event_filters = '{}'::jsonb
WHERE event_filters IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'badges_event_filters_object_check'
      AND conrelid = 'public.badges'::regclass
  ) THEN
    ALTER TABLE public.badges
      ADD CONSTRAINT badges_event_filters_object_check
      CHECK (jsonb_typeof(event_filters) = 'object');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_difficulty_level(p_difficulty text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_parts text[];
BEGIN
  v_raw := lower(btrim(coalesce(p_difficulty, '')));

  IF v_raw = '' THEN
    RETURN NULL;
  END IF;

  IF v_raw ~ '^[1-5]$' THEN
    RETURN v_raw::integer;
  END IF;

  v_parts := regexp_match(v_raw, '(^|[^0-9])([1-5])\s*/\s*5([^0-9]|$)');
  IF v_parts IS NOT NULL THEN
    RETURN v_parts[2]::integer;
  END IF;

  RETURN CASE v_raw
    WHEN 'beginner' THEN 1
    WHEN 'easy' THEN 1
    WHEN 'facile' THEN 1
    WHEN 'introduzione' THEN 1
    WHEN 'prima volta' THEN 1
    WHEN 'esploratore' THEN 2
    WHEN 'intermedio' THEN 3
    WHEN 'escursionista' THEN 3
    WHEN 'impegnativo' THEN 4
    WHEN 'intrepido' THEN 4
    WHEN 'advanced' THEN 5
    WHEN 'hard' THEN 5
    WHEN 'expert' THEN 5
    WHEN 'avanzato' THEN 5
    ELSE NULL
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_user_attended_events_in_category(
  p_user_id uuid,
  p_category text,
  p_event_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT er.event_id)::integer
  FROM public.event_registrations er
  JOIN public.events e ON e.id = er.event_id
  LEFT JOIN public.event_categories ec ON ec.id = e.category_id
  WHERE er.user_id = p_user_id
    AND er.event_id IS NOT NULL
    AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
    AND (er.checked_in = true OR er.status = 'attended')
    AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
    AND (
      ec.name = p_category
      OR e.additional_fields ->> 'fit_score_main_category' = p_category
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(e.additional_fields -> 'fit_score_secondary_categories') = 'array'
              THEN e.additional_fields -> 'fit_score_secondary_categories'
            ELSE '[]'::jsonb
          END
        ) AS secondary_category(name)
        WHERE secondary_category.name = p_category
      )
    )
    AND (
      COALESCE(p_event_filters ->> 'min_difficulty', '') !~ '^[1-5]$'
      OR public.event_difficulty_level(e.difficulty) >= (p_event_filters ->> 'min_difficulty')::integer
    )
    AND (
      COALESCE(p_event_filters ->> 'max_difficulty', '') !~ '^[1-5]$'
      OR public.event_difficulty_level(e.difficulty) <= (p_event_filters ->> 'max_difficulty')::integer
    );
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
        AND COALESCE(requirement_type, 'events_attended') = 'events_attended'
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
      SELECT b.id, b.category, b.required_events, b.event_filters
      FROM public.badges b
      WHERE b.category IS NOT NULL
        AND b.category != 'special'
        AND COALESCE(b.requirement_type, 'category_events') IN ('events_attended', 'category_events')
    LOOP
      v_cat_count := public.count_user_attended_events_in_category(
        v_user_id,
        v_badge.category,
        COALESCE(v_badge.event_filters, '{}'::jsonb)
      );

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

UPDATE public.badges
SET requirement_type = 'category_events',
    event_filters = jsonb_strip_nulls(
      COALESCE(event_filters, '{}'::jsonb) || jsonb_build_object('min_difficulty', 4)
    )
WHERE name = 'Spirito d''Avventura';

REVOKE ALL ON FUNCTION public.event_difficulty_level(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_difficulty_level(text) TO anon;
GRANT EXECUTE ON FUNCTION public.event_difficulty_level(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.event_difficulty_level(text) TO service_role;

REVOKE ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.award_badges_on_checkin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_badges_on_checkin() FROM anon;
REVOKE ALL ON FUNCTION public.award_badges_on_checkin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_badges_on_checkin() TO service_role;
