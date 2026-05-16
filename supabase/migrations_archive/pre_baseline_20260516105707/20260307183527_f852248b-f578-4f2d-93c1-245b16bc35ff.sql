
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System/admins can insert notifications
CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow inserts from triggers (service role)
CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;

-- Trigger function to create notification on registration
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
  SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'registered' OR NEW.status = 'paid' THEN
      v_notification_type := 'registration';
      v_title := 'Iscrizione confermata';
      v_message := 'Ti sei iscritto a "' || v_event_title || '"';
    ELSIF NEW.status = 'waitlist' THEN
      v_notification_type := 'waitlist';
      v_title := 'In lista d''attesa';
      v_message := 'Sei in lista d''attesa per "' || v_event_title || '"';
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, v_notification_type, v_title, v_message, NEW.event_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Waitlist promotion
    IF OLD.status = 'waitlist' AND NEW.status = 'registered' THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, 'waitlist_promotion', 'Promosso dalla lista d''attesa!', 'Un posto si è liberato per "' || v_event_title || '". Sei stato iscritto!', NEW.event_id);
    END IF;
    -- Payment confirmation
    IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, 'payment', 'Pagamento confermato', 'Il pagamento per "' || v_event_title || '" è stato confermato.', NEW.event_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER notify_registration_trigger
  AFTER INSERT OR UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_registration();

-- Trigger for event updates
CREATE OR REPLACE FUNCTION public.notify_on_event_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Notify registered users when event details change
  IF OLD.date != NEW.date OR OLD.time != NEW.time OR OLD.location != NEW.location OR OLD.status != NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, event_id)
    SELECT er.user_id, 'event_update', 'Evento aggiornato', 'L''evento "' || NEW.title || '" è stato aggiornato. Controlla i dettagli.', NEW.id
    FROM public.event_registrations er
    WHERE er.event_id = NEW.id AND er.status IN ('registered', 'paid');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_event_update_trigger
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_event_update();
