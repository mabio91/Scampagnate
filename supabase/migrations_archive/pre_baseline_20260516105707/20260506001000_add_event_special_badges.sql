CREATE TABLE IF NOT EXISTS public.event_special_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, badge_id)
);

ALTER TABLE public.event_special_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view event special badges" ON public.event_special_badges;
CREATE POLICY "Anyone can view event special badges"
  ON public.event_special_badges
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Organizers can manage event special badges" ON public.event_special_badges;
CREATE POLICY "Organizers can manage event special badges"
  ON public.event_special_badges
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_special_badges.event_id
        AND (
          e.organizer_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.badges b ON b.id = event_special_badges.badge_id
      WHERE e.id = event_special_badges.event_id
        AND b.category = 'special'
        AND b.name <> 'Founding Member'
        AND (
          e.organizer_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DELETE FROM public.user_badges a
USING public.user_badges b
WHERE a.user_id = b.user_id
  AND a.badge_id = b.badge_id
  AND a.id > b.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_badges_user_badge_unique'
      AND conrelid = 'public.user_badges'::regclass
  ) THEN
    ALTER TABLE public.user_badges
      ADD CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id);
  END IF;
END;
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
  v_marked_attended boolean;
BEGIN
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

    UPDATE public.profiles
    SET total_points = greatest(coalesce(total_points, 0), v_attended_count)
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;
