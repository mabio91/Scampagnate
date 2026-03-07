
CREATE OR REPLACE FUNCTION public.notify_on_issue_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status != 'resolved' AND NEW.status = 'resolved' AND NEW.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.reporter_id,
      'issue_resolved',
      'Issue Resolved',
      'Your reported issue "' || NEW.title || '" has been resolved. Thank you for helping us improve!'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_issue_resolved
  AFTER UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_issue_resolved();
