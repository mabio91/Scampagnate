create table if not exists public.event_closing_sentences (
  id uuid primary key default gen_random_uuid(),
  sentence text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_closing_sentences_sentence_not_blank
    check (length(btrim(sentence)) between 1 and 280)
);

create index if not exists idx_event_closing_sentences_active_order
  on public.event_closing_sentences (is_active, sort_order, sentence);

create or replace function public.set_event_closing_sentences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_event_closing_sentences_updated_at on public.event_closing_sentences;
create trigger set_event_closing_sentences_updated_at
before update on public.event_closing_sentences
for each row execute function public.set_event_closing_sentences_updated_at();

alter table public.event_closing_sentences enable row level security;

drop policy if exists "Anyone can view active event closing sentences" on public.event_closing_sentences;
create policy "Anyone can view active event closing sentences"
on public.event_closing_sentences
for select
using (
  is_active = true
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'organizer'::public.app_role)
);

drop policy if exists "Admins can manage event closing sentences" on public.event_closing_sentences;
create policy "Admins can manage event closing sentences"
on public.event_closing_sentences
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

grant select on public.event_closing_sentences to anon, authenticated;
grant insert, update, delete on public.event_closing_sentences to authenticated;

insert into public.event_closing_sentences (sentence, sort_order, is_active)
values
  ('Porta leggerezza, al resto pensiamo noi', 10, true),
  ('Una community che arriva per i sentieri... e resta per le persone', 20, true),
  ('Il difficile è venire. Poi non vorrai più andare via', 30, true),
  ('Fidati: sarà una di quelle giornate che ricordi', 40, true),
  ('Vieni con lo spirito giusto - il resto viene da sé', 50, true),
  ('Qui si conoscono persone, non solo posti', 60, true)
on conflict (sentence) do update
set
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
