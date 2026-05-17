CREATE TABLE IF NOT EXISTS public.event_opening_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cancelled_at timestamp with time zone,
  notified_at timestamp with time zone
);

COMMENT ON TABLE public.event_opening_reminders IS
  'User opt-ins to be notified when registrations open for upcoming events.';

CREATE UNIQUE INDEX IF NOT EXISTS event_opening_reminders_active_unique
  ON public.event_opening_reminders (user_id, event_id)
  WHERE cancelled_at IS NULL AND notified_at IS NULL;

CREATE INDEX IF NOT EXISTS event_opening_reminders_event_active_idx
  ON public.event_opening_reminders (event_id, created_at)
  WHERE cancelled_at IS NULL AND notified_at IS NULL;

CREATE INDEX IF NOT EXISTS event_opening_reminders_user_active_idx
  ON public.event_opening_reminders (user_id, created_at DESC)
  WHERE cancelled_at IS NULL AND notified_at IS NULL;

ALTER TABLE public.event_opening_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own event opening reminders"
  ON public.event_opening_reminders;
CREATE POLICY "Users can view own event opening reminders"
  ON public.event_opening_reminders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own event opening reminders"
  ON public.event_opening_reminders;
CREATE POLICY "Users can create own event opening reminders"
  ON public.event_opening_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND cancelled_at IS NULL
    AND notified_at IS NULL
  );

DROP POLICY IF EXISTS "Users can cancel own event opening reminders"
  ON public.event_opening_reminders;
CREATE POLICY "Users can cancel own event opening reminders"
  ON public.event_opening_reminders
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND cancelled_at IS NULL
    AND notified_at IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    AND cancelled_at IS NOT NULL
    AND notified_at IS NULL
  );

DROP POLICY IF EXISTS "Admins can manage event opening reminders"
  ON public.event_opening_reminders;
CREATE POLICY "Admins can manage event opening reminders"
  ON public.event_opening_reminders
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT ALL ON TABLE public.event_opening_reminders TO authenticated;
GRANT ALL ON TABLE public.event_opening_reminders TO service_role;

CREATE OR REPLACE FUNCTION public.notify_event_opening_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_event_registration_open_status(NEW.status::text)
     OR public.is_event_registration_open_status(OLD.status::text) THEN
    RETURN NEW;
  END IF;

  WITH due_reminders AS (
    SELECT id, user_id
    FROM public.event_opening_reminders
    WHERE event_id = NEW.id
      AND cancelled_at IS NULL
      AND notified_at IS NULL
  ),
  inserted_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, message, event_id)
    SELECT
      user_id,
      'event_opening',
      'Iscrizioni aperte!',
      'Le iscrizioni per "' || NEW.title || '" sono aperte. Prenota ora il tuo posto.',
      NEW.id
    FROM due_reminders
    RETURNING user_id
  )
  UPDATE public.event_opening_reminders reminders
  SET notified_at = now()
  FROM due_reminders
  WHERE reminders.id = due_reminders.id
    AND EXISTS (
      SELECT 1
      FROM inserted_notifications
      WHERE inserted_notifications.user_id = due_reminders.user_id
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_event_opening_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_event_opening_reminders() FROM anon;
REVOKE ALL ON FUNCTION public.notify_event_opening_reminders() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_event_opening_reminders() TO service_role;

DROP TRIGGER IF EXISTS notify_event_opening_reminders_trigger ON public.events;
CREATE TRIGGER notify_event_opening_reminders_trigger
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_event_opening_reminders();
