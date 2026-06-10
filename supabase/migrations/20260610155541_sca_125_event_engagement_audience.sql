-- SCA-125: expose saved/reminder audience for admin and organizer follow-up.

CREATE OR REPLACE FUNCTION public.get_event_engagement_audience(
  p_event_id uuid,
  p_kind text
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  display_name text,
  email text,
  phone text,
  instagram_handle text,
  avatar_url text,
  created_at timestamp with time zone,
  status text
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
  accessible_event AS (
    SELECT e.id
    FROM public.events e
    CROSS JOIN caller c
    WHERE c.user_id IS NOT NULL
      AND p_event_id IS NOT NULL
      AND p_kind IN ('saved', 'reminder')
      AND e.id = p_event_id
      AND (c.is_admin OR e.organizer_id = c.user_id)
  ),
  saved AS (
    SELECT
      se.id,
      se.user_id,
      se.created_at,
      'saved'::text AS status
    FROM public.saved_events se
    JOIN accessible_event ae ON ae.id = se.event_id
    WHERE p_kind = 'saved'
  ),
  reminders AS (
    SELECT
      r.id,
      r.user_id,
      r.created_at,
      CASE
        WHEN r.notified_at IS NULL THEN 'active_reminder'
        ELSE 'notified_reminder'
      END::text AS status
    FROM public.event_opening_reminders r
    JOIN accessible_event ae ON ae.id = r.event_id
    WHERE p_kind = 'reminder'
      AND r.cancelled_at IS NULL
  ),
  audience AS (
    SELECT * FROM saved
    UNION ALL
    SELECT * FROM reminders
  )
  SELECT
    audience.id,
    audience.user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ', profiles.first_name, profiles.last_name)), ''),
      'Utente ' || LEFT(audience.user_id::text, 8)
    ) AS display_name,
    profiles.email,
    profiles.phone,
    profiles.instagram_handle,
    profiles.avatar_url,
    audience.created_at,
    audience.status
  FROM audience
  LEFT JOIN public.profiles ON profiles.id = audience.user_id
  ORDER BY audience.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_event_engagement_audience(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_engagement_audience(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_engagement_audience(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
