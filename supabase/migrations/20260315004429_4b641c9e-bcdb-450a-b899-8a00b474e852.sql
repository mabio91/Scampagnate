
CREATE OR REPLACE FUNCTION public.notify_on_proposal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text;
  v_message text;
  v_type text;
BEGIN
  -- Only fire when status actually changes and proposer_id exists
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.proposer_id IS NOT NULL THEN
    CASE NEW.status
      WHEN 'reviewed' THEN
        v_type := 'proposal_reviewed';
        v_title := 'Proposta valutata';
        v_message := 'La tua proposta "' || NEW.activity_title || '" è stata valutata dal team.';
      WHEN 'archived' THEN
        v_type := 'proposal_archived';
        v_title := 'Proposta archiviata';
        v_message := 'La tua proposta "' || NEW.activity_title || '" è stata archiviata.';
      WHEN 'converted' THEN
        v_type := 'proposal_converted';
        v_title := 'Proposta approvata! 🎉';
        v_message := 'La tua proposta "' || NEW.activity_title || '" è stata convertita in un evento ufficiale!';
      ELSE
        RETURN NEW;
    END CASE;

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.proposer_id, v_type, v_title, v_message);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS on_proposal_status_change ON public.activity_proposals;

CREATE TRIGGER on_proposal_status_change
  AFTER UPDATE ON public.activity_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_proposal_status_change();
