alter table public.profiles
  add column if not exists instagram_handle text;

alter table public.profiles
  drop constraint if exists profiles_instagram_handle_format_check;

alter table public.profiles
  add constraint profiles_instagram_handle_format_check
  check (
    instagram_handle is null
    or instagram_handle ~ '^[a-z0-9._]{1,30}$'
  );

create index if not exists profiles_instagram_handle_idx
  on public.profiles (instagram_handle)
  where instagram_handle is not null;

comment on column public.profiles.instagram_handle is
  'Normalized Instagram handle without @ or URL. Visible to admins and to organizers only for confirmed participants in their own events via profiles RLS.';
