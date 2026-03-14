
-- Add new values to event_status enum
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'past';

-- Add new values to registration_status enum  
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'attended';
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'no_show';
