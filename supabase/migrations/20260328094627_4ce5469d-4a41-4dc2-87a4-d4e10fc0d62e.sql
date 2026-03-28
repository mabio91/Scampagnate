
-- Create onesignal_players table to store OneSignal Player IDs linked to users
CREATE TABLE public.onesignal_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_id text NOT NULL,
  device_type text DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, player_id)
);

-- Enable RLS
ALTER TABLE public.onesignal_players ENABLE ROW LEVEL SECURITY;

-- Users can manage their own player records
CREATE POLICY "Users can manage own onesignal players"
  ON public.onesignal_players FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update the send_push_on_notification trigger function to call the new OneSignal edge function
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://etiynvukviykquqcsjln.supabase.co/functions/v1/send-onesignal-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI"}'::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'title', NEW.title,
      'message', NEW.message,
      'event_id', NEW.event_id::text,
      'type', NEW.type
    )
  );
  RETURN NEW;
END;
$function$;
