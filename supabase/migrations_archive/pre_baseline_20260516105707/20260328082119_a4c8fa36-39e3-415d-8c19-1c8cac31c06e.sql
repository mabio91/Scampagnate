-- Insert default welcome email template if none exists
INSERT INTO public.email_templates (
  template_key, name, subject, body_html, preview_text,
  cta_label, cta_url, sender_name, reply_to, is_active
)
SELECT
  'welcome_email_v1',
  'Welcome Email',
  'Benvenuto in Scampagnate 🌿',
  '<p>Ciao {{first_name}},</p>
<p>benvenuto in <strong>Scampagnate</strong>!</p>
<p>Il tuo profilo è stato creato correttamente e ora puoi iniziare a scoprire eventi, attività e nuove esperienze insieme alla community.</p>
<p>Ci vediamo presto,<br>Team Scampagnate</p>',
  'Il tuo account è stato creato con successo. Ora puoi iniziare a scoprire gli eventi.',
  'Scopri gli eventi',
  '/',
  'Scampagnate',
  'info@scampagnate.com',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_key LIKE 'welcome_email%' AND is_active = true
);

-- Update the DB trigger function to pass all needed fields
CREATE OR REPLACE FUNCTION public.send_welcome_email_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://etiynvukviykquqcsjln.supabase.co/functions/v1/send-welcome-email',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI'
    )::jsonb,
    body := jsonb_build_object(
      'userId', NEW.id::text,
      'email', NEW.email,
      'firstName', COALESCE(NEW.first_name, ''),
      'lastName', COALESCE(NEW.last_name, '')
    )
  );
  RETURN NEW;
END;
$function$;

-- Attach the trigger to the profiles table (only on INSERT, fires once per new user)
DROP TRIGGER IF EXISTS on_profile_created_send_welcome ON public.profiles;
CREATE TRIGGER on_profile_created_send_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email_on_signup();