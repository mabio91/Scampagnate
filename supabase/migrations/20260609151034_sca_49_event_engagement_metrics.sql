-- SCA-49: event engagement metrics for admin and organizer surfaces.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_notifications_event_opening_clicked
  ON public.notifications (event_id, clicked_at)
  WHERE type = 'event_opening' AND clicked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_events_event_id
  ON public.saved_events (event_id);

CREATE INDEX IF NOT EXISTS idx_event_opening_reminders_event_notified
  ON public.event_opening_reminders (event_id, notified_at)
  WHERE cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_event_engagement_metrics(p_event_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  event_id uuid,
  saved_count bigint,
  opening_reminder_active_count bigint,
  opening_reminder_notified_count bigint,
  opening_notification_click_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH caller AS (
    SELECT
      auth.uid() AS user_id,
      public.has_role(auth.uid(), 'admin'::public.app_role) AS is_admin
  ),
  accessible_events AS (
    SELECT e.id
    FROM public.events e
    CROSS JOIN caller c
    WHERE c.user_id IS NOT NULL
      AND (p_event_ids IS NULL OR e.id = ANY(p_event_ids))
      AND (c.is_admin OR e.organizer_id = c.user_id)
  ),
  saved AS (
    SELECT se.event_id, count(DISTINCT se.user_id)::bigint AS saved_count
    FROM public.saved_events se
    JOIN accessible_events ae ON ae.id = se.event_id
    GROUP BY se.event_id
  ),
  reminders AS (
    SELECT
      r.event_id,
      count(DISTINCT r.user_id) FILTER (
        WHERE r.cancelled_at IS NULL AND r.notified_at IS NULL
      )::bigint AS opening_reminder_active_count,
      count(DISTINCT r.user_id) FILTER (
        WHERE r.cancelled_at IS NULL AND r.notified_at IS NOT NULL
      )::bigint AS opening_reminder_notified_count
    FROM public.event_opening_reminders r
    JOIN accessible_events ae ON ae.id = r.event_id
    GROUP BY r.event_id
  ),
  clicks AS (
    SELECT
      n.event_id,
      count(DISTINCT n.user_id)::bigint AS opening_notification_click_count
    FROM public.notifications n
    JOIN accessible_events ae ON ae.id = n.event_id
    WHERE n.type = 'event_opening'
      AND n.clicked_at IS NOT NULL
    GROUP BY n.event_id
  )
  SELECT
    ae.id AS event_id,
    COALESCE(saved.saved_count, 0)::bigint AS saved_count,
    COALESCE(reminders.opening_reminder_active_count, 0)::bigint AS opening_reminder_active_count,
    COALESCE(reminders.opening_reminder_notified_count, 0)::bigint AS opening_reminder_notified_count,
    COALESCE(clicks.opening_notification_click_count, 0)::bigint AS opening_notification_click_count
  FROM accessible_events ae
  LEFT JOIN saved ON saved.event_id = ae.id
  LEFT JOIN reminders ON reminders.event_id = ae.id
  LEFT JOIN clicks ON clicks.event_id = ae.id
  ORDER BY ae.id;
$$;

REVOKE ALL ON FUNCTION public.get_event_engagement_metrics(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_engagement_metrics(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.invoke_scampagnate_edge_function(
    'send-onesignal-notification',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'notification_id', NEW.id,
      'title', NEW.title,
      'message', NEW.message,
      'event_id', NEW.event_id,
      'type', NEW.type
    )
  );

  PERFORM public.invoke_scampagnate_edge_function(
    'send-ios-push-notification',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'notification_id', NEW.id,
      'title', NEW.title,
      'message', NEW.message,
      'event_id', NEW.event_id,
      'type', NEW.type
    )
  );

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
