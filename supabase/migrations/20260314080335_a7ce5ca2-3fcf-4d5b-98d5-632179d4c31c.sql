
-- Update all existing events with status 'available' to 'published'
UPDATE public.events SET status = 'published' WHERE status = 'available';

-- Update the update_spots_taken function to use 'published' instead of 'available'
CREATE OR REPLACE FUNCTION public.update_spots_taken()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.events SET spots_taken = (
      SELECT COUNT(*) FROM public.event_registrations 
      WHERE event_id = NEW.event_id AND status IN ('registered', 'paid')
    ) WHERE id = NEW.event_id;
    -- Auto-set to full if spots are filled
    UPDATE public.events SET status = 'full' 
    WHERE id = NEW.event_id AND spots_taken >= spots_total AND status = 'published';
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET spots_taken = (
      SELECT COUNT(*) FROM public.event_registrations 
      WHERE event_id = OLD.event_id AND status IN ('registered', 'paid')
    ) WHERE id = OLD.event_id;
    -- Re-open if spots available
    UPDATE public.events SET status = 'published'
    WHERE id = OLD.event_id AND spots_taken < spots_total AND status = 'full';
    RETURN OLD;
  END IF;
END;
$function$;

-- Update promote_from_waitlist to use 'published' instead of 'available'
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
  v_next_waitlist record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_event_id := NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_id := OLD.event_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT spots_total, spots_taken INTO v_spots_total, v_spots_taken
  FROM public.events WHERE id = v_event_id;

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
      
      UPDATE public.events
      SET status = 'published'
      WHERE id = v_event_id AND status = 'full';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
