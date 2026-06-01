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

  UPDATE public.event_price_options epo
  SET spots_taken = public.count_event_option_active_participants(epo.id)
  WHERE epo.event_id = p_event_id
    AND epo.spots_taken IS DISTINCT FROM public.count_event_option_active_participants(epo.id);

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
  SELECT id, status, spots_total
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_event_registration_open_status(v_event.status::text) THEN
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

  v_option_taken := public.count_event_option_active_participants(v_option.id);
  RETURN GREATEST(COALESCE(v_option.dedicated_spots, 0) - v_option_taken, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_option_availability(p_event_id uuid)
RETURNS TABLE(
  option_id uuid,
  event_id uuid,
  event_remaining integer,
  option_spots_taken integer,
  option_spots_total integer,
  option_remaining integer,
  real_remaining integer,
  is_bookable boolean,
  waitlist_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH event_stats AS (
    SELECT
      e.id,
      GREATEST(
        COALESCE(e.spots_total, 0) - public.count_event_active_participants(e.id),
        0
      )::integer AS event_remaining
    FROM public.events e
    WHERE e.id = p_event_id
  ),
  option_stats AS (
    SELECT
      epo.*,
      public.count_event_option_active_participants(epo.id)::integer AS active_taken
    FROM public.event_price_options epo
    WHERE epo.event_id = p_event_id
  )
  SELECT
    os.id AS option_id,
    os.event_id,
    es.event_remaining,
    os.active_taken AS option_spots_taken,
    CASE
      WHEN os.has_dedicated_spots THEN os.dedicated_spots
      ELSE NULL
    END AS option_spots_total,
    CASE
      WHEN os.has_dedicated_spots AND os.dedicated_spots IS NOT NULL
      THEN GREATEST(COALESCE(os.dedicated_spots, 0) - os.active_taken, 0)::integer
      ELSE NULL
    END AS option_remaining,
    CASE
      WHEN os.has_dedicated_spots AND os.dedicated_spots IS NOT NULL
      THEN LEAST(
        es.event_remaining,
        GREATEST(COALESCE(os.dedicated_spots, 0) - os.active_taken, 0)
      )::integer
      ELSE es.event_remaining
    END AS real_remaining,
    public.is_event_option_bookable(os.event_id, os.id) AS is_bookable,
    COALESCE(os.waitlist_enabled, true) AS waitlist_enabled
  FROM option_stats os
  JOIN event_stats es ON es.id = os.event_id
  ORDER BY os.sort_order ASC, os.created_at ASC;
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
BEGIN
  v_new_active := public.is_active_event_participant_status(NEW.status::text, NEW.payment_status);

  IF NOT v_new_active THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_active := public.is_active_event_participant_status(OLD.status::text, OLD.payment_status);

    IF v_old_active
      AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id
      AND NEW.price_option_id IS NOT DISTINCT FROM OLD.price_option_id THEN
      RETURN NEW;
    END IF;

    v_consumes_event_spot := (NOT v_old_active) OR NEW.event_id IS DISTINCT FROM OLD.event_id;
  END IF;

  SELECT id, spots_total
  INTO v_event
  FROM public.events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_event.id IS NULL THEN
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

DROP TRIGGER IF EXISTS enforce_event_registration_capacity_trigger ON public.event_registrations;
CREATE TRIGGER enforce_event_registration_capacity_trigger
BEFORE INSERT OR UPDATE OF event_id, price_option_id, status, payment_status
ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_registration_capacity();

UPDATE public.event_price_options epo
SET spots_taken = public.count_event_option_active_participants(epo.id)
WHERE epo.spots_taken IS DISTINCT FROM public.count_event_option_active_participants(epo.id);
