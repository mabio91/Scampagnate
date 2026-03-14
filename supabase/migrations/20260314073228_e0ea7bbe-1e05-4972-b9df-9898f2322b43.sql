
-- Drop the view and recreate with SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS public.public_profiles;

-- Create a security definer function to get public profile data (bypasses RLS intentionally)
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE(id uuid, first_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

-- Function to get multiple public profiles
CREATE OR REPLACE FUNCTION public.get_public_profiles(profile_ids uuid[])
RETURNS TABLE(id uuid, first_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids);
$$;
