
-- Add a FK from event_registrations.user_id to profiles.id
-- This allows PostgREST to join event_registrations with profiles
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
