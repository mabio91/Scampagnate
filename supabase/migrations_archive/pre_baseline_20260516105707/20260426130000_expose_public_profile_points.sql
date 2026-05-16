DROP FUNCTION IF EXISTS public.get_public_profiles(uuid[]);
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

CREATE FUNCTION public.get_public_profiles(profile_ids uuid[])
 RETURNS TABLE(id uuid, first_name text, avatar_url text, last_name_initial text, total_points integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.first_name,
    p.avatar_url,
    CASE WHEN p.last_name IS NOT NULL AND p.last_name != '' THEN LEFT(p.last_name, 1) || '.' ELSE NULL END,
    p.total_points
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids);
$$;

CREATE FUNCTION public.get_public_profile(profile_id uuid)
 RETURNS TABLE(id uuid, first_name text, avatar_url text, last_name_initial text, total_points integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.first_name,
    p.avatar_url,
    CASE WHEN p.last_name IS NOT NULL AND p.last_name != '' THEN LEFT(p.last_name, 1) || '.' ELSE NULL END,
    p.total_points
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;
