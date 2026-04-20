ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS car_availability text,
  ADD COLUMN IF NOT EXISTS additional_responses jsonb;
