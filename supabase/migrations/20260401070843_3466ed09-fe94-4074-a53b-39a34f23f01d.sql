
CREATE OR REPLACE FUNCTION public.promote_from_waitlist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Only trigger on cancellation
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT spots_total, spots_taken, title INTO v_spots_total, v_spots_taken, v_event_title
  FROM public.events WHERE id = v_event_id;

  -- If spots are now available and there are waitlisted users, notify ALL of them
  IF v_spots_taken < v_spots_total THEN
    -- Re-open event if it was full
    UPDATE public.events SET status = 'published'
    WHERE id = v_event_id AND status = 'full';

    -- Notify ALL waitlisted users
    FOR v_waitlist_user IN
      SELECT user_id FROM public.event_registrations
      WHERE event_id = v_event_id AND status = 'waitlist'
      ORDER BY created_at ASC
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (
        v_waitlist_user.user_id,
        'waitlist_spot_available',
        'Posto disponibile! 🎉',
        'Buone notizie: si è liberato un posto per "' || v_event_title || '"! Puoi prenotarlo ora, ma fai in fretta: andrà al primo che completa la prenotazione 💪',
        v_event_id
      );
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
