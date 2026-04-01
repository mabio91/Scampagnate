
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
      WHERE event_id = NEW.event_id 
        AND status IN ('registered', 'paid')
        AND payment_status IS DISTINCT FROM 'pending'
    ) WHERE id = NEW.event_id;
    -- Auto-set to full if spots are filled
    UPDATE public.events SET status = 'full' 
    WHERE id = NEW.event_id AND spots_taken >= spots_total AND status = 'published';
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET spots_taken = (
      SELECT COUNT(*) FROM public.event_registrations 
      WHERE event_id = OLD.event_id 
        AND status IN ('registered', 'paid')
        AND payment_status IS DISTINCT FROM 'pending'
    ) WHERE id = OLD.event_id;
    -- Re-open if spots available
    UPDATE public.events SET status = 'published'
    WHERE id = OLD.event_id AND spots_taken < spots_total AND status = 'full';
    RETURN OLD;
  END IF;
END;
$function$;
