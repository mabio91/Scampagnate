-- Manual/event-staff inserted participants must be real event registrations,
-- but profile-less manual rows must not borrow the organizer/admin user_id.

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_event_registration_added_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.added_by := auth.uid();
  ELSIF NEW.added_by IS NULL THEN
    NEW.added_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_event_registration_added_by_trigger ON public.event_registrations;
CREATE TRIGGER set_event_registration_added_by_trigger
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_event_registration_added_by();

-- Preserve who inserted legacy manual rows before clearing the participant id.
UPDATE public.event_registrations
SET added_by = COALESCE(added_by, user_id)
WHERE user_id IS NOT NULL
  AND COALESCE(sport_level, '') LIKE 'manual:%';

ALTER TABLE public.event_registrations
  ALTER COLUMN user_id DROP NOT NULL;

UPDATE public.event_registrations
SET user_id = NULL
WHERE COALESCE(sport_level, '') LIKE 'manual:%';

DROP INDEX IF EXISTS public.event_registrations_event_user_unique;
CREATE UNIQUE INDEX event_registrations_event_user_unique
  ON public.event_registrations (event_id, user_id)
  WHERE user_id IS NOT NULL
    AND status <> 'cancelled'
    AND COALESCE(sport_level, '') NOT LIKE 'manual:%';

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_manual_identity_check;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_manual_identity_check
  CHECK (
    (user_id IS NOT NULL AND COALESCE(sport_level, '') NOT LIKE 'manual:%')
    OR
    (user_id IS NULL AND COALESCE(sport_level, '') LIKE 'manual:%')
  );

DROP POLICY IF EXISTS "Organizers can insert registrations for own events" ON public.event_registrations;
CREATE POLICY "Organizers can insert registrations for own events"
  ON public.event_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events
      WHERE events.id = event_registrations.event_id
        AND (
          events.organizer_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

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
    AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
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
    AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
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

    UPDATE public.profiles
    SET total_points = greatest(coalesce(total_points, 0), v_attended_count)
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_title text;
  v_notification_type text;
  v_title text;
  v_message text;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.sport_level, '') LIKE 'manual:%' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'registered' OR NEW.status = 'paid' THEN
      v_notification_type := 'registration';
      v_title := 'Iscrizione confermata';
      v_message := 'Ti sei iscritto a "' || v_event_title || '"';
    ELSIF NEW.status = 'waitlist' THEN
      v_notification_type := 'waitlist';
      v_title := 'In lista d''attesa';
      v_message := 'Sei in lista d''attesa per "' || v_event_title || '"';
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, v_notification_type, v_title, v_message, NEW.event_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'waitlist' AND NEW.status = 'registered' THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, 'waitlist_promotion', 'Promosso dalla lista d''attesa!', 'Un posto si e liberato per "' || v_event_title || '". Sei stato iscritto!', NEW.event_id);
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, 'payment', 'Pagamento confermato', 'Il pagamento per "' || v_event_title || '" e stato confermato.', NEW.event_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_event_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.date != NEW.date OR OLD.time != NEW.time OR OLD.location != NEW.location OR OLD.status != NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, event_id)
    SELECT er.user_id, 'event_update', 'Evento aggiornato', 'L''evento "' || NEW.title || '" e stato aggiornato. Controlla i dettagli.', NEW.id
    FROM public.event_registrations er
    WHERE er.event_id = NEW.id
      AND er.user_id IS NOT NULL
      AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
      AND er.status IN ('registered', 'paid');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_from_waitlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_spots_total int;
  v_spots_taken int;
  v_event_title text;
  v_waitlist_user record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_event_id := NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_id := OLD.event_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.status <> 'cancelled' OR OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT spots_total, spots_taken, title INTO v_spots_total, v_spots_taken, v_event_title
  FROM public.events WHERE id = v_event_id;

  IF v_spots_taken < v_spots_total THEN
    UPDATE public.events SET status = 'published'
    WHERE id = v_event_id AND status = 'full';

    FOR v_waitlist_user IN
      SELECT user_id
      FROM public.event_registrations
      WHERE event_id = v_event_id
        AND user_id IS NOT NULL
        AND COALESCE(sport_level, '') NOT LIKE 'manual:%'
        AND status = 'waitlist'
      ORDER BY created_at ASC
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = v_waitlist_user.user_id
          AND n.event_id = v_event_id
          AND n.type = 'waitlist_spot_available'
          AND n.created_at > now() - interval '5 minutes'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, message, event_id)
        VALUES (
          v_waitlist_user.user_id,
          'waitlist_spot_available',
          'Posto disponibile!',
          'Buone notizie: si e liberato un posto per "' || v_event_title || '". Puoi prenotarlo ora.',
          v_event_id
        );
      END IF;
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
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
    IF OLD.user_id IS NOT NULL AND COALESCE(OLD.sport_level, '') NOT LIKE 'manual:%' THEN
      PERFORM public.sync_user_missions_for_user(OLD.user_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.user_id IS NOT NULL AND COALESCE(NEW.sport_level, '') NOT LIKE 'manual:%' THEN
    PERFORM public.sync_user_missions_for_user(NEW.user_id);
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.user_id IS DISTINCT FROM OLD.user_id
    AND OLD.user_id IS NOT NULL
    AND COALESCE(OLD.sport_level, '') NOT LIKE 'manual:%'
  THEN
    PERFORM public.sync_user_missions_for_user(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_participant_avatars(p_event_id uuid)
RETURNS TABLE(user_id uuid, avatar_url text, first_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    er.user_id,
    CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL ELSE p.avatar_url END AS avatar_url,
    CASE
      WHEN COALESCE(er.sport_level, '') LIKE 'manual:%'
        THEN COALESCE(NULLIF(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
      ELSE COALESCE(NULLIF(p.first_name, ''), 'Partecipante')
    END AS first_name
  FROM public.event_registrations er
  LEFT JOIN public.profiles p ON p.id = er.user_id
  WHERE er.event_id = p_event_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status)
    AND (
      (er.user_id IS NULL AND COALESCE(er.sport_level, '') LIKE 'manual:%')
      OR p.id IS NOT NULL
    )
  ORDER BY er.created_at ASC
  LIMIT 4;
$$;

DROP FUNCTION IF EXISTS public.get_event_people_public(uuid);

CREATE FUNCTION public.get_event_people_public(p_event_id uuid)
RETURNS TABLE(
  id text,
  user_id uuid,
  first_name text,
  last_name_initial text,
  avatar_url text,
  age integer,
  total_points integer,
  role text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH event_row AS (
    SELECT e.id, e.organizer_id, e.organizer_name
    FROM public.events e
    WHERE e.id = p_event_id
  ),
  participant_rows AS (
    SELECT
      er.id::text AS id,
      er.user_id,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%'
          THEN COALESCE(NULLIF(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
        ELSE COALESCE(NULLIF(p.first_name, ''), 'Partecipante')
      END AS first_name,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        ELSE NULLIF(upper(left(COALESCE(p.last_name, ''), 1)), '')
      END AS last_name_initial,
      CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL ELSE p.avatar_url END AS avatar_url,
      CASE
        WHEN p.birth_date IS NULL OR COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        ELSE date_part('year', age(p.birth_date))::integer
      END AS age,
      CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN 0 ELSE COALESCE(p.total_points, 0) END AS total_points,
      'participant'::text AS role,
      (10 + row_number() OVER (ORDER BY er.created_at ASC))::integer AS sort_order
    FROM public.event_registrations er
    LEFT JOIN public.profiles p ON p.id = er.user_id
    WHERE er.event_id = p_event_id
      AND public.is_active_event_participant_status(er.status::text, er.payment_status)
      AND (
        (er.user_id IS NULL AND COALESCE(er.sport_level, '') LIKE 'manual:%')
        OR p.id IS NOT NULL
      )
  )
  SELECT
    ('organizer:' || COALESCE(p.id::text, event_row.organizer_id::text, event_row.id::text)) AS id,
    p.id AS user_id,
    COALESCE(NULLIF(p.first_name, ''), event_row.organizer_name, 'Organizzatore') AS first_name,
    NULLIF(upper(left(COALESCE(p.last_name, ''), 1)), '') AS last_name_initial,
    p.avatar_url,
    CASE WHEN p.birth_date IS NULL THEN NULL ELSE date_part('year', age(p.birth_date))::integer END AS age,
    COALESCE(p.total_points, 0) AS total_points,
    'organizer'::text AS role,
    0 AS sort_order
  FROM event_row
  LEFT JOIN public.profiles p ON p.id = event_row.organizer_id
  WHERE event_row.organizer_id IS NOT NULL

  UNION ALL

  SELECT
    participant_rows.id,
    participant_rows.user_id,
    participant_rows.first_name,
    participant_rows.last_name_initial,
    participant_rows.avatar_url,
    participant_rows.age,
    participant_rows.total_points,
    participant_rows.role,
    participant_rows.sort_order
  FROM participant_rows
  ORDER BY sort_order ASC;
$$;

DO $$
DECLARE
  affected_user record;
BEGIN
  FOR affected_user IN
    SELECT DISTINCT added_by AS user_id
    FROM public.event_registrations
    WHERE added_by IS NOT NULL
      AND COALESCE(sport_level, '') LIKE 'manual:%'
  LOOP
    PERFORM public.sync_user_missions_for_user(affected_user.user_id);
  END LOOP;
END;
$$;
