
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles (full data)
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Organizers can view profiles of participants in their events
CREATE POLICY "Organizers can view participant profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_registrations er
    JOIN public.events e ON e.id = er.event_id
    WHERE er.user_id = profiles.id
    AND e.organizer_id = auth.uid()
  )
);

-- Create a public view with only non-sensitive fields for general access
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, first_name, avatar_url
FROM public.profiles;

-- Grant access to the view for all roles
GRANT SELECT ON public.public_profiles TO anon;
GRANT SELECT ON public.public_profiles TO authenticated;
