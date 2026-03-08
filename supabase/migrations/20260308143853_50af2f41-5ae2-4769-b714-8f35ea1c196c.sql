CREATE TRIGGER trigger_award_badges_on_checkin
  AFTER UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.award_badges_on_checkin();