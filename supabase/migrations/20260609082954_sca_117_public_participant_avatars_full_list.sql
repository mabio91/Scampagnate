CREATE OR REPLACE FUNCTION public.get_event_participant_avatars(p_event_id uuid)
RETURNS TABLE(user_id uuid, avatar_url text, first_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    er.user_id,
    CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL ELSE p.avatar_url END AS avatar_url,
    CASE
      WHEN COALESCE(er.sport_level, '') LIKE 'manual:%'
        THEN COALESCE(NULLIF(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
      ELSE COALESCE(NULLIF(p.first_name, ''), 'Partecipante')
    END AS first_name
  FROM public.event_registrations er
  LEFT JOIN public.profiles p ON p.id = er.user_id
  WHERE er.event_id = p_event_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status)
    AND (
      (er.user_id IS NULL AND COALESCE(er.sport_level, '') LIKE 'manual:%')
      OR p.id IS NOT NULL
    )
  ORDER BY er.created_at ASC;
$$;
