
-- ============================================
-- 1. Create all missing triggers
-- ============================================

-- Trigger: update spots_taken on registration changes
CREATE TRIGGER on_registration_update_spots
  AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_spots_taken();

-- Trigger: promote from waitlist on cancellation/deletion
CREATE TRIGGER on_registration_promote_waitlist
  AFTER UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_from_waitlist();

-- Trigger: notify user on registration
CREATE TRIGGER on_registration_notify
  AFTER INSERT OR UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_registration();

-- Trigger: notify participants on event update
CREATE TRIGGER on_event_update_notify
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_event_update();

-- Trigger: award badges on check-in
CREATE TRIGGER on_checkin_award_badges
  AFTER UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.award_badges_on_checkin();

-- Trigger: notify on issue resolved
CREATE TRIGGER on_issue_resolved_notify
  AFTER UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_issue_resolved();

-- ============================================
-- 2. Fix unique index to allow re-registration after cancellation
-- ============================================

-- Drop the old partial index
DROP INDEX IF EXISTS event_registrations_event_user_unique;

-- Create new partial unique index that excludes cancelled AND manual entries
CREATE UNIQUE INDEX event_registrations_event_user_unique
  ON public.event_registrations (event_id, user_id)
  WHERE (status != 'cancelled' AND (sport_level IS NULL OR sport_level NOT LIKE 'manual:%'));
