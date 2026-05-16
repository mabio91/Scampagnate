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
      'Problema risolto',
      'Il problema che hai segnalato "' || NEW.title || '" è stato risolto. Grazie per averci aiutato a migliorare!'
    );
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.notifications
SET
  title = 'Problema risolto',
  message = regexp_replace(
    message,
    '^Your reported issue "(.+)" has been resolved\. Thank you for helping us improve!$',
    'Il problema che hai segnalato "\1" è stato risolto. Grazie per averci aiutato a migliorare!',
    'g'
  )
WHERE title = 'Issue Resolved'
   OR message ~ '^Your reported issue ".*" has been resolved\. Thank you for helping us improve!$';

UPDATE public.notifications
SET
  title = 'Grazie per esserti iscritto!',
  message = CASE
    WHEN COALESCE(message, '') = '' THEN 'Riceverai gli aggiornamenti di Scampagnate direttamente nelle notifiche.'
    ELSE message
  END
WHERE title = 'Thanks for subscribing!';
