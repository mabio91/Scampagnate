
-- Function to auto-promote first waitlisted user when a spot opens
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
  v_next_waitlist record;
BEGIN
  -- Determine which event was affected
  IF TG_OP = 'UPDATE' THEN
    v_event_id := NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_id := OLD.event_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only run if the registration was cancelled or deleted
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('cancelled') THEN
    RETURN NEW;
  END IF;

  -- Get event capacity info
  SELECT spots_total, spots_taken INTO v_spots_total, v_spots_taken
  FROM public.events WHERE id = v_event_id;

  -- If there are open spots, promote the earliest waitlisted user
  IF v_spots_taken < v_spots_total THEN
    SELECT id INTO v_next_waitlist
    FROM public.event_registrations
    WHERE event_id = v_event_id AND status = 'waitlist'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_next_waitlist IS NOT NULL THEN
      UPDATE public.event_registrations
      SET status = 'registered'
      WHERE id = v_next_waitlist.id;
      
      -- Re-open event if it was full
      UPDATE public.events
      SET status = 'available'
      WHERE id = v_event_id AND status = 'full';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger: run after a registration is cancelled or deleted
CREATE TRIGGER promote_waitlist_on_cancel
  AFTER UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_from_waitlist();
