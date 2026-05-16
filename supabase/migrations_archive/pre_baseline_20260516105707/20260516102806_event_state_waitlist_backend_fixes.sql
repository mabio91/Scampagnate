ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'unpublished';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'upcoming';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'rescheduled';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'completed';

CREATE OR REPLACE FUNCTION public.is_event_registration_open_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(p_status, '') IN ('available', 'published', 'open');
$$;

CREATE OR REPLACE FUNCTION public.is_event_closed_for_registration_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NOT public.is_event_registration_open_status(p_status);
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
    status = 'published',
    additional_fields = coalesce(additional_fields, '{}'::jsonb) - 'sold_out_mode'
  WHERE id = p_event_id
    AND spots_taken < spots_total
    AND status = 'full'
    AND coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode' = 'automatic';
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
      status = 'published',
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
    IF NEW.status IN ('registered', 'paid', 'deposit_paid') THEN
      v_notification_type := 'registration';
      v_title := 'Iscrizione confermata';
      v_message := 'Ti sei iscritto a "' || v_event_title || '"';
    ELSIF NEW.status = 'waitlist' THEN
      v_notification_type := 'waitlist';
      v_title := 'In lista d''attesa';
      v_message := 'Sei in lista d''attesa per "' || v_event_title || '"';
    END IF;

    IF v_title IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = NEW.user_id
        AND n.event_id = NEW.event_id
        AND n.type = v_notification_type
        AND n.created_at > now() - interval '5 minutes'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, v_notification_type, v_title, v_message, NEW.event_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'waitlist' AND NEW.status IN ('registered', 'paid', 'deposit_paid') THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, 'waitlist_promotion', 'Posto disponibile!', 'Un posto si e liberato per "' || v_event_title || '". Completa la prenotazione per confermare.', NEW.event_id);
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = NEW.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'payment'
          AND n.created_at > now() - interval '5 minutes'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, message, event_id)
        VALUES (NEW.user_id, 'payment', 'Pagamento confermato', 'Il pagamento per "' || v_event_title || '" e stato confermato.', NEW.event_id);
      END IF;
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
  IF OLD.date IS DISTINCT FROM NEW.date
    OR OLD.time IS DISTINCT FROM NEW.time
    OR OLD.location IS DISTINCT FROM NEW.location
    OR OLD.status IS DISTINCT FROM NEW.status
  THEN
    INSERT INTO public.notifications (user_id, type, title, message, event_id)
    SELECT er.user_id, 'event_update', 'Evento aggiornato', 'L''evento "' || NEW.title || '" e stato aggiornato. Controlla i dettagli.', NEW.id
    FROM public.event_registrations er
    WHERE er.event_id = NEW.id
      AND er.user_id IS NOT NULL
      AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
      AND er.status IN ('registered', 'deposit_paid', 'paid');
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.events
SET additional_fields = coalesce(additional_fields, '{}'::jsonb)
  || jsonb_build_object('sold_out_mode', 'automatic')
WHERE status = 'full'
  AND spots_total > 0
  AND spots_taken >= spots_total
  AND coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode' IS NULL;

DO $$
DECLARE
  event_row record;
BEGIN
  FOR event_row IN SELECT id FROM public.events LOOP
    PERFORM public.refresh_event_spots(event_row.id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_event_registration_open_status(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_event_closed_for_registration_status(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_event_spots(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_from_waitlist() FROM PUBLIC, anon, authenticated;
