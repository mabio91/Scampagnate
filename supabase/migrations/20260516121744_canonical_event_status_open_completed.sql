-- Canonical event states:
-- - "open" is the only writable state that means registrations are active.
-- - "completed" replaces the legacy automatic "past" state.
-- Legacy "available"/"published" are kept as rollout aliases but normalized away.

ALTER TABLE public.events
  ALTER COLUMN status SET DEFAULT 'open'::public.event_status;

UPDATE public.events
SET status = 'open'::public.event_status
WHERE status IN ('available'::public.event_status, 'published'::public.event_status);

UPDATE public.events
SET status = 'completed'::public.event_status
WHERE status = 'past'::public.event_status;

CREATE OR REPLACE FUNCTION public.is_event_registration_open_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(p_status, '') IN ('open', 'available', 'published');
$$;

CREATE OR REPLACE FUNCTION public.is_event_option_bookable(p_event_id uuid, p_price_option_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event record;
  v_event_remaining integer;
  v_option record;
BEGIN
  SELECT id, status, spots_total, spots_taken
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_event_registration_open_status(v_event.status::text) THEN
    RETURN false;
  END IF;

  v_event_remaining := GREATEST(COALESCE(v_event.spots_total, 0) - COALESCE(v_event.spots_taken, 0), 0);
  IF v_event_remaining <= 0 THEN
    RETURN false;
  END IF;

  IF p_price_option_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.event_price_options epo
      WHERE epo.event_id = p_event_id
    ) THEN
      RETURN true;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.event_price_options epo
      WHERE epo.event_id = p_event_id
        AND (
          COALESCE(epo.has_dedicated_spots, false) = false
          OR epo.dedicated_spots IS NULL
          OR GREATEST(COALESCE(epo.dedicated_spots, 0) - COALESCE(epo.spots_taken, 0), 0) > 0
        )
    );
  END IF;

  SELECT id, event_id, has_dedicated_spots, dedicated_spots, spots_taken
  INTO v_option
  FROM public.event_price_options
  WHERE id = p_price_option_id
    AND event_id = p_event_id;

  IF v_option.id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v_option.has_dedicated_spots, false) = false OR v_option.dedicated_spots IS NULL THEN
    RETURN true;
  END IF;

  RETURN GREATEST(COALESCE(v_option.dedicated_spots, 0) - COALESCE(v_option.spots_taken, 0), 0) > 0;
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
  v_event_status text;
  v_sold_out_mode text;
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

  SELECT spots_total, spots_taken, title, status::text, coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode'
  INTO v_spots_total, v_spots_taken, v_event_title, v_event_status, v_sold_out_mode
  FROM public.events
  WHERE id = v_event_id;

  IF v_spots_taken < v_spots_total AND (v_event_status <> 'full' OR v_sold_out_mode = 'automatic') THEN
    UPDATE public.events
    SET
      status = 'open',
      additional_fields = coalesce(additional_fields, '{}'::jsonb) - 'sold_out_mode'
    WHERE id = v_event_id
      AND status = 'full'
      AND coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode' = 'automatic';

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

CREATE OR REPLACE FUNCTION public.refresh_event_spots(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.events
  SET spots_taken = public.count_event_active_participants(p_event_id)
  WHERE id = p_event_id;

  UPDATE public.events
  SET
    status = 'full',
    additional_fields = coalesce(additional_fields, '{}'::jsonb)
      || jsonb_build_object('sold_out_mode', 'automatic')
  WHERE id = p_event_id
    AND spots_total > 0
    AND spots_taken >= spots_total
    AND public.is_event_registration_open_status(status::text);

  UPDATE public.events
  SET
    status = 'open',
    additional_fields = coalesce(additional_fields, '{}'::jsonb) - 'sold_out_mode'
  WHERE id = p_event_id
    AND spots_taken < spots_total
    AND status = 'full'
    AND coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode' = 'automatic';
END;
$$;
