
-- Enable pg_net for HTTP calls from triggers
create extension if not exists pg_net with schema extensions;

-- Push subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now() not null,
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own push subscriptions"
on public.push_subscriptions for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Trigger function to send push notification via edge function
create or replace function public.send_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform net.http_post(
    url := 'https://etiynvukviykquqcsjln.supabase.co/functions/v1/send-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aXludnVrdml5a3F1cWNzamxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDAxNDMsImV4cCI6MjA4ODQxNjE0M30.IHz7Uu8AN4p9Ufewn1vPo1ECA_LcOrcDVZSPK8vORPI"}'::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'title', NEW.title,
      'message', NEW.message,
      'event_id', NEW.event_id::text,
      'type', NEW.type
    )
  );
  return NEW;
end;
$$;

create trigger on_notification_send_push
after insert on public.notifications
for each row
execute function public.send_push_on_notification();
