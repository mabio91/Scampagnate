drop function if exists public.get_public_profile(uuid);
drop function if exists public.get_public_profiles(uuid[]);

create or replace function public.get_public_profile(profile_id uuid)
returns table(
  id uuid,
  first_name text,
  avatar_url text,
  last_name_initial text,
  total_points integer,
  phone text,
  bio text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p.id,
    p.first_name,
    p.avatar_url,
    case
      when p.last_name is not null and p.last_name <> '' then left(p.last_name, 1) || '.'
      else null
    end as last_name_initial,
    p.total_points,
    case
      when auth.uid() is not null and (
        exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role in ('organizer'::public.app_role, 'admin'::public.app_role)
        )
        or exists (
          select 1
          from public.events e
          where e.organizer_id = p.id
            and coalesce(e.visibility, 'public') = 'public'
        )
      )
      then nullif(p.phone, '')
      else null
    end as phone,
    case
      when auth.uid() is not null and (
        exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role in ('organizer'::public.app_role, 'admin'::public.app_role)
        )
        or exists (
          select 1
          from public.events e
          where e.organizer_id = p.id
            and coalesce(e.visibility, 'public') = 'public'
        )
      )
      then nullif(p.bio, '')
      else null
    end as bio
  from public.profiles p
  where p.id = profile_id;
$$;

create or replace function public.get_public_profiles(profile_ids uuid[])
returns table(
  id uuid,
  first_name text,
  avatar_url text,
  last_name_initial text,
  total_points integer,
  phone text,
  bio text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p.id,
    p.first_name,
    p.avatar_url,
    case
      when p.last_name is not null and p.last_name <> '' then left(p.last_name, 1) || '.'
      else null
    end as last_name_initial,
    p.total_points,
    case
      when auth.uid() is not null and (
        exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role in ('organizer'::public.app_role, 'admin'::public.app_role)
        )
        or exists (
          select 1
          from public.events e
          where e.organizer_id = p.id
            and coalesce(e.visibility, 'public') = 'public'
        )
      )
      then nullif(p.phone, '')
      else null
    end as phone,
    case
      when auth.uid() is not null and (
        exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role in ('organizer'::public.app_role, 'admin'::public.app_role)
        )
        or exists (
          select 1
          from public.events e
          where e.organizer_id = p.id
            and coalesce(e.visibility, 'public') = 'public'
        )
      )
      then nullif(p.bio, '')
      else null
    end as bio
  from public.profiles p
  where p.id = any(profile_ids);
$$;

grant execute on function public.get_public_profile(uuid) to anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_public_profile(uuid) to service_role;

grant execute on function public.get_public_profiles(uuid[]) to anon;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;
grant execute on function public.get_public_profiles(uuid[]) to service_role;

comment on function public.get_public_profile(uuid) is
  'Public profile summary. Organizer contact fields are only returned for authenticated requests and contactable organizer profiles.';

comment on function public.get_public_profiles(uuid[]) is
  'Public profile summaries. Organizer contact fields are only returned for authenticated requests and contactable organizer profiles.';

notify pgrst, 'reload schema';
