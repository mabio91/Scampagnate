CREATE OR REPLACE FUNCTION public.is_active_event_participant_status(
  p_status text,
  p_payment_status text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(p_status, '') IN ('registered', 'deposit_paid', 'paid', 'attended', 'no_show')
    AND coalesce(p_payment_status, '') <> 'pending';
$$;

CREATE OR REPLACE FUNCTION public.count_event_active_participants(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer
  FROM public.event_registrations er
  WHERE er.event_id = p_event_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status);
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
  SET status = 'full'
  WHERE id = p_event_id
    AND spots_total > 0
    AND spots_taken >= spots_total
    AND status = 'published';

  UPDATE public.events
  SET status = 'published'
  WHERE id = p_event_id
    AND spots_taken < spots_total
    AND status = 'full';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_spots_taken()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_event_spots(NEW.event_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      PERFORM public.refresh_event_spots(OLD.event_id);
    END IF;
    PERFORM public.refresh_event_spots(NEW.event_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_spots(OLD.event_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_participant_avatars(p_event_id uuid)
RETURNS TABLE(user_id uuid, avatar_url text, first_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT er.user_id, p.avatar_url, p.first_name
  FROM public.event_registrations er
  JOIN public.profiles p ON p.id = er.user_id
  WHERE er.event_id = p_event_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status)
  ORDER BY er.created_at ASC
  LIMIT 4;
$$;

DO $$
DECLARE
  event_row record;
BEGIN
  FOR event_row IN SELECT id FROM public.events LOOP
    PERFORM public.refresh_event_spots(event_row.id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_event_active_participants(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_event_spots(uuid) FROM PUBLIC, anon, authenticated;
