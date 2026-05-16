
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS self_level text,
  ADD COLUMN IF NOT EXISTS has_car text,
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_motivation text;
