-- SCA-109: stop user-facing "Evento aggiornato" notifications.
-- Event edits, including automatic status changes after capacity changes, should
-- not notify participants through the in-app/push notification pipeline.

DROP TRIGGER IF EXISTS notify_event_update_trigger ON public.events;

CREATE OR REPLACE FUNCTION public.notify_on_event_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_event_update() IS
  'Disabled by SCA-109: event updates must not create user-facing event_update notifications.';
