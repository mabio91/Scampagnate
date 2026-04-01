CREATE OR REPLACE FUNCTION public.get_event_participant_avatars(p_event_id uuid)
RETURNS TABLE(user_id uuid, avatar_url text, first_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT er.user_id, p.avatar_url, p.first_name
  FROM event_registrations er
  JOIN profiles p ON p.id = er.user_id
  WHERE er.event_id = p_event_id
    AND er.status IN ('registered', 'paid')
  ORDER BY er.created_at ASC
  LIMIT 4;
$$;