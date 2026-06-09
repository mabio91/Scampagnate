DROP FUNCTION IF EXISTS public.get_event_people_public(uuid);

CREATE OR REPLACE FUNCTION public.get_event_people_public(p_event_id uuid)
RETURNS TABLE(
  id text,
  user_id uuid,
  first_name text,
  last_name_initial text,
  last_name text,
  avatar_url text,
  age integer,
  total_points integer,
  bio text,
  attended_events_count integer,
  badges jsonb,
  role text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH event_row AS (
    SELECT
      e.id,
      e.organizer_id,
      e.organizer_name,
      auth.uid() IS NOT NULL
        AND (
          e.organizer_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        ) AS can_view_full_names
    FROM public.events e
    WHERE e.id = p_event_id
  ),
  participant_rows AS (
    SELECT
      er.id::text AS id,
      er.user_id,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%'
          THEN COALESCE(NULLIF(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
        ELSE COALESCE(NULLIF(p.first_name, ''), 'Partecipante')
      END AS first_name,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        ELSE NULLIF(upper(left(COALESCE(p.last_name, ''), 1)), '')
      END AS last_name_initial,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        WHEN event_row.can_view_full_names THEN NULLIF(trim(COALESCE(p.last_name, '')), '')
        ELSE NULL
      END AS last_name,
      CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL ELSE p.avatar_url END AS avatar_url,
      CASE
        WHEN p.birth_date IS NULL OR COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        ELSE date_part('year', age(p.birth_date))::integer
      END AS age,
      CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN 0 ELSE COALESCE(p.total_points, 0) END AS total_points,
      CASE
        WHEN auth.uid() IS NOT NULL AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
          THEN NULLIF(p.bio, '')
        ELSE NULL
      END AS bio,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN 0
        ELSE COALESCE(history.attended_events_count, 0)
      END AS attended_events_count,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN '[]'::jsonb
        ELSE COALESCE(user_badges.badges, '[]'::jsonb)
      END AS badges,
      'participant'::text AS role,
      (10 + row_number() OVER (ORDER BY er.created_at ASC))::integer AS sort_order
    FROM public.event_registrations er
    JOIN event_row ON event_row.id = er.event_id
    LEFT JOIN public.profiles p ON p.id = er.user_id
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS attended_events_count
      FROM (
        SELECT DISTINCT ON (ehr.event_id)
          ehr.event_id,
          ehr.status,
          ehr.checked_in
        FROM public.event_registrations ehr
        WHERE ehr.user_id = er.user_id
          AND ehr.event_id IS NOT NULL
        ORDER BY
          ehr.event_id,
          CASE
            WHEN ehr.status::text IN ('registered', 'deposit_paid', 'paid', 'attended')
              AND (ehr.checked_in = true OR ehr.status::text = 'attended') THEN 5
            WHEN ehr.status::text IN ('registered', 'deposit_paid', 'paid', 'attended') THEN 4
            WHEN ehr.status::text = 'no_show' THEN 3
            WHEN ehr.status::text = 'cancelled' THEN 2
            ELSE 1
          END DESC,
          ehr.created_at DESC
      ) ranked
      WHERE ranked.status::text IN ('registered', 'deposit_paid', 'paid', 'attended')
        AND (ranked.checked_in = true OR ranked.status::text = 'attended')
    ) history ON er.user_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'icon', b.icon
        )
        ORDER BY ub.earned_at DESC
      ) FILTER (WHERE b.id IS NOT NULL) AS badges
      FROM public.user_badges ub
      JOIN public.badges b ON b.id = ub.badge_id
      WHERE ub.user_id = er.user_id
        AND COALESCE(ub.completed, true) = true
    ) user_badges ON er.user_id IS NOT NULL
    WHERE er.event_id = p_event_id
      AND public.is_active_event_participant_status(er.status::text, er.payment_status)
      AND (
        (er.user_id IS NULL AND COALESCE(er.sport_level, '') LIKE 'manual:%')
        OR p.id IS NOT NULL
      )
  )
  SELECT
    ('organizer:' || COALESCE(p.id::text, event_row.organizer_id::text, event_row.id::text)) AS id,
    p.id AS user_id,
    COALESCE(NULLIF(p.first_name, ''), event_row.organizer_name, 'Organizzatore') AS first_name,
    NULLIF(upper(left(COALESCE(p.last_name, ''), 1)), '') AS last_name_initial,
    CASE
      WHEN event_row.can_view_full_names THEN NULLIF(trim(COALESCE(p.last_name, '')), '')
      ELSE NULL
    END AS last_name,
    p.avatar_url,
    CASE WHEN p.birth_date IS NULL THEN NULL ELSE date_part('year', age(p.birth_date))::integer END AS age,
    COALESCE(p.total_points, 0) AS total_points,
    CASE WHEN auth.uid() IS NOT NULL THEN NULLIF(p.bio, '') ELSE NULL END AS bio,
    COALESCE(history.attended_events_count, 0) AS attended_events_count,
    COALESCE(user_badges.badges, '[]'::jsonb) AS badges,
    'organizer'::text AS role,
    0 AS sort_order
  FROM event_row
  LEFT JOIN public.profiles p ON p.id = event_row.organizer_id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS attended_events_count
    FROM (
      SELECT DISTINCT ON (ehr.event_id)
        ehr.event_id,
        ehr.status,
        ehr.checked_in
      FROM public.event_registrations ehr
      WHERE ehr.user_id = p.id
        AND ehr.event_id IS NOT NULL
      ORDER BY
        ehr.event_id,
        CASE
          WHEN ehr.status::text IN ('registered', 'deposit_paid', 'paid', 'attended')
            AND (ehr.checked_in = true OR ehr.status::text = 'attended') THEN 5
          WHEN ehr.status::text IN ('registered', 'deposit_paid', 'paid', 'attended') THEN 4
          WHEN ehr.status::text = 'no_show' THEN 3
          WHEN ehr.status::text = 'cancelled' THEN 2
          ELSE 1
        END DESC,
        ehr.created_at DESC
    ) ranked
    WHERE ranked.status::text IN ('registered', 'deposit_paid', 'paid', 'attended')
      AND (ranked.checked_in = true OR ranked.status::text = 'attended')
  ) history ON p.id IS NOT NULL
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', b.name,
        'icon', b.icon
      )
      ORDER BY ub.earned_at DESC
    ) FILTER (WHERE b.id IS NOT NULL) AS badges
    FROM public.user_badges ub
    JOIN public.badges b ON b.id = ub.badge_id
    WHERE ub.user_id = p.id
      AND COALESCE(ub.completed, true) = true
  ) user_badges ON p.id IS NOT NULL
  WHERE event_row.organizer_id IS NOT NULL

  UNION ALL

  SELECT
    participant_rows.id,
    participant_rows.user_id,
    participant_rows.first_name,
    participant_rows.last_name_initial,
    participant_rows.last_name,
    participant_rows.avatar_url,
    participant_rows.age,
    participant_rows.total_points,
    participant_rows.bio,
    participant_rows.attended_events_count,
    participant_rows.badges,
    participant_rows.role,
    participant_rows.sort_order
  FROM participant_rows
  ORDER BY sort_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_people_public(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_people_public(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_people_public(uuid) TO service_role;

COMMENT ON FUNCTION public.get_event_people_public(uuid) IS
  'Public event people list. Bio is returned only to authenticated callers; last_name is returned only to event organizers and admins.';

NOTIFY pgrst, 'reload schema';
