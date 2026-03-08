
-- Drop duplicate triggers (keep the original ones)
DROP TRIGGER IF EXISTS on_registration_update_spots ON public.event_registrations;
DROP TRIGGER IF EXISTS on_registration_promote_waitlist ON public.event_registrations;
DROP TRIGGER IF EXISTS on_registration_notify ON public.event_registrations;
DROP TRIGGER IF EXISTS on_event_update_notify ON public.events;
DROP TRIGGER IF EXISTS on_checkin_award_badges ON public.event_registrations;
DROP TRIGGER IF EXISTS on_issue_resolved_notify ON public.issues;
