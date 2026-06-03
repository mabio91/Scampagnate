CREATE OR REPLACE FUNCTION public.event_registration_start_at(
  p_date date,
  p_time time without time zone
)
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT (p_date + p_time) AT TIME ZONE 'Europe/Rome';
$$;

CREATE OR REPLACE FUNCTION public.is_event_registration_open_at(
  p_event_id uuid,
  p_reference timestamp with time zone DEFAULT now()
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND public.is_event_registration_open_status(e.status::text)
      AND public.event_registration_start_at(e.date, e.time) > p_reference
  );
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
  v_event_taken integer;
  v_event_remaining integer;
  v_option record;
  v_option_taken integer;
BEGIN
  SELECT id, status, date, time, spots_total
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_event_registration_open_status(v_event.status::text)
     OR public.event_registration_start_at(v_event.date, v_event.time) <= now() THEN
    RETURN false;
  END IF;

  v_event_taken := public.count_event_active_participants(p_event_id);
  v_event_remaining := GREATEST(COALESCE(v_event.spots_total, 0) - v_event_taken, 0);
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
          OR GREATEST(
            COALESCE(epo.dedicated_spots, 0) - public.count_event_option_active_participants(epo.id),
            0
          ) > 0
        )
    );
  END IF;

  SELECT id, event_id, has_dedicated_spots, dedicated_spots
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

  v_option_taken := public.count_event_option_active_participants(p_price_option_id);
  RETURN GREATEST(COALESCE(v_option.dedicated_spots, 0) - v_option_taken, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_event_registration_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_active boolean;
  v_old_active boolean := false;
  v_consumes_event_spot boolean := true;
  v_event record;
  v_option record;
  v_event_taken integer;
  v_option_taken integer;
  v_blocks_new_registration boolean;
BEGIN
  v_new_active := public.is_active_event_participant_status(NEW.status::text, NEW.payment_status);
  v_blocks_new_registration := COALESCE(NEW.user_id::text, '') <> ''
    AND COALESCE(NEW.sport_level, '') NOT LIKE 'manual:%'
    AND COALESCE(NEW.status::text, '') IN ('registered', 'deposit_paid', 'paid', 'pending_payment', 'pending_approval', 'waitlist');

  IF TG_OP = 'UPDATE' THEN
    v_old_active := public.is_active_event_participant_status(OLD.status::text, OLD.payment_status);

    IF v_old_active
      AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id
      AND NEW.price_option_id IS NOT DISTINCT FROM OLD.price_option_id THEN
      RETURN NEW;
    END IF;

    v_consumes_event_spot := (NOT v_old_active) OR NEW.event_id IS DISTINCT FROM OLD.event_id;
  END IF;

  IF NOT v_new_active AND NOT v_blocks_new_registration THEN
    RETURN NEW;
  END IF;

  SELECT id, status, date, time, spots_total
  INTO v_event
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_event.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_blocks_new_registration
     AND (
       NOT public.is_event_registration_open_status(v_event.status::text)
       OR public.event_registration_start_at(v_event.date, v_event.time) <= now()
     ) THEN
    RAISE EXCEPTION 'Le iscrizioni per questo evento sono chiuse.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_new_active THEN
    RETURN NEW;
  END IF;

  IF v_consumes_event_spot AND COALESCE(v_event.spots_total, 0) > 0 THEN
    SELECT count(*)::integer
    INTO v_event_taken
    FROM public.event_registrations er
    WHERE er.event_id = NEW.event_id
      AND er.id IS DISTINCT FROM NEW.id
      AND public.is_active_event_participant_status(er.status::text, er.payment_status);

    IF v_event_taken >= COALESCE(v_event.spots_total, 0) THEN
      RAISE EXCEPTION 'Non ci sono posti disponibili per questo evento.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.price_option_id IS NOT NULL THEN
    SELECT id, event_id, has_dedicated_spots, dedicated_spots
    INTO v_option
    FROM public.event_price_options
    WHERE id = NEW.price_option_id
    FOR UPDATE;

    IF v_option.id IS NULL THEN
      RETURN NEW;
    END IF;

    IF v_option.event_id IS DISTINCT FROM NEW.event_id THEN
      RAISE EXCEPTION 'La formula di prezzo selezionata non appartiene a questo evento.'
        USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_option.has_dedicated_spots, false) AND v_option.dedicated_spots IS NOT NULL THEN
      SELECT count(*)::integer
      INTO v_option_taken
      FROM public.event_registrations er
      WHERE er.price_option_id = NEW.price_option_id
        AND er.id IS DISTINCT FROM NEW.id
        AND public.is_active_event_participant_status(er.status::text, er.payment_status);

      IF v_option_taken >= GREATEST(COALESCE(v_option.dedicated_spots, 0), 0) THEN
        RAISE EXCEPTION 'Questa formula non ha più posti dedicati disponibili.'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
