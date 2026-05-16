create table if not exists public.broadcast_message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null
);

alter table public.broadcast_message_templates enable row level security;

create policy "Organizers and admins can view broadcast templates"
on public.broadcast_message_templates
for select
using (
  has_role(auth.uid(), 'organizer'::app_role)
  or has_role(auth.uid(), 'admin'::app_role)
);

create policy "Admins can insert broadcast templates"
on public.broadcast_message_templates
for insert
with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can update broadcast templates"
on public.broadcast_message_templates
for update
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));

create policy "Admins can delete broadcast templates"
on public.broadcast_message_templates
for delete
using (has_role(auth.uid(), 'admin'::app_role));

insert into public.broadcast_message_templates (title, message, sort_order)
select *
from (
  values
    ('Time change', 'Important update for "{{event_title}}": the event time has been changed. Please check the event page for the updated schedule.', 1),
    ('Meeting point', 'Meeting point update for "{{event_title}}": the meeting point has been updated. Please check the event page for new details.', 2),
    ('Weather alert', 'Weather update for "{{event_title}}": please check the weather forecast and come prepared. The event will proceed as planned unless further notice.', 3),
    ('Reminder', 'Reminder: "{{event_title}}" is coming up! Don''t forget to check the event details and prepare accordingly. See you there!', 4)
) as seed(title, message, sort_order)
where not exists (
  select 1 from public.broadcast_message_templates
);
