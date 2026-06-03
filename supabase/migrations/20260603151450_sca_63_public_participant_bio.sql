drop function if exists public.get_event_people_public(uuid);

create or replace function public.get_event_people_public(p_event_id uuid)
returns table(
  id text,
  user_id uuid,
  first_name text,
  last_name_initial text,
  avatar_url text,
  age integer,
  total_points integer,
  bio text,
  attended_events_count integer,
  badges jsonb,
  role text,
  sort_order integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with event_row as (
    select e.id, e.organizer_id, e.organizer_name
    from public.events e
    where e.id = p_event_id
  ),
  participant_rows as (
    select
      er.id::text as id,
      er.user_id,
      case
        when coalesce(er.sport_level, '') like 'manual:%'
          then coalesce(nullif(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
        else coalesce(nullif(p.first_name, ''), 'Partecipante')
      end as first_name,
      case
        when coalesce(er.sport_level, '') like 'manual:%' then null
        else nullif(upper(left(coalesce(p.last_name, ''), 1)), '')
      end as last_name_initial,
      case when coalesce(er.sport_level, '') like 'manual:%' then null else p.avatar_url end as avatar_url,
      case
        when p.birth_date is null or coalesce(er.sport_level, '') like 'manual:%' then null
        else date_part('year', age(p.birth_date))::integer
      end as age,
      case when coalesce(er.sport_level, '') like 'manual:%' then 0 else coalesce(p.total_points, 0) end as total_points,
      case
        when auth.uid() is not null and coalesce(er.sport_level, '') not like 'manual:%'
          then nullif(p.bio, '')
        else null
      end as bio,
      case
        when coalesce(er.sport_level, '') like 'manual:%' then 0
        else coalesce(history.attended_events_count, 0)
      end as attended_events_count,
      case
        when coalesce(er.sport_level, '') like 'manual:%' then '[]'::jsonb
        else coalesce(user_badges.badges, '[]'::jsonb)
      end as badges,
      'participant'::text as role,
      (10 + row_number() over (order by er.created_at asc))::integer as sort_order
    from public.event_registrations er
    left join public.profiles p on p.id = er.user_id
    left join lateral (
      select count(*)::integer as attended_events_count
      from (
        select distinct on (ehr.event_id)
          ehr.event_id,
          ehr.status,
          ehr.checked_in
        from public.event_registrations ehr
        where ehr.user_id = er.user_id
          and ehr.event_id is not null
        order by
          ehr.event_id,
          case
            when ehr.status::text in ('registered', 'deposit_paid', 'paid', 'attended')
              and (ehr.checked_in = true or ehr.status::text = 'attended') then 5
            when ehr.status::text in ('registered', 'deposit_paid', 'paid', 'attended') then 4
            when ehr.status::text = 'no_show' then 3
            when ehr.status::text = 'cancelled' then 2
            else 1
          end desc,
          ehr.created_at desc
      ) ranked
      where ranked.status::text in ('registered', 'deposit_paid', 'paid', 'attended')
        and (ranked.checked_in = true or ranked.status::text = 'attended')
    ) history on er.user_id is not null
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'name', b.name,
          'icon', b.icon
        )
        order by ub.earned_at desc
      ) filter (where b.id is not null) as badges
      from public.user_badges ub
      join public.badges b on b.id = ub.badge_id
      where ub.user_id = er.user_id
        and coalesce(ub.completed, true) = true
    ) user_badges on er.user_id is not null
    where er.event_id = p_event_id
      and public.is_active_event_participant_status(er.status::text, er.payment_status)
      and (
        (er.user_id is null and coalesce(er.sport_level, '') like 'manual:%')
        or p.id is not null
      )
  )
  select
    ('organizer:' || coalesce(p.id::text, event_row.organizer_id::text, event_row.id::text)) as id,
    p.id as user_id,
    coalesce(nullif(p.first_name, ''), event_row.organizer_name, 'Organizzatore') as first_name,
    nullif(upper(left(coalesce(p.last_name, ''), 1)), '') as last_name_initial,
    p.avatar_url,
    case when p.birth_date is null then null else date_part('year', age(p.birth_date))::integer end as age,
    coalesce(p.total_points, 0) as total_points,
    case when auth.uid() is not null then nullif(p.bio, '') else null end as bio,
    coalesce(history.attended_events_count, 0) as attended_events_count,
    coalesce(user_badges.badges, '[]'::jsonb) as badges,
    'organizer'::text as role,
    0 as sort_order
  from event_row
  left join public.profiles p on p.id = event_row.organizer_id
  left join lateral (
    select count(*)::integer as attended_events_count
    from (
      select distinct on (ehr.event_id)
        ehr.event_id,
        ehr.status,
        ehr.checked_in
      from public.event_registrations ehr
      where ehr.user_id = p.id
        and ehr.event_id is not null
      order by
        ehr.event_id,
        case
          when ehr.status::text in ('registered', 'deposit_paid', 'paid', 'attended')
            and (ehr.checked_in = true or ehr.status::text = 'attended') then 5
          when ehr.status::text in ('registered', 'deposit_paid', 'paid', 'attended') then 4
          when ehr.status::text = 'no_show' then 3
          when ehr.status::text = 'cancelled' then 2
          else 1
        end desc,
        ehr.created_at desc
    ) ranked
    where ranked.status::text in ('registered', 'deposit_paid', 'paid', 'attended')
      and (ranked.checked_in = true or ranked.status::text = 'attended')
  ) history on p.id is not null
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'name', b.name,
        'icon', b.icon
      )
      order by ub.earned_at desc
    ) filter (where b.id is not null) as badges
    from public.user_badges ub
    join public.badges b on b.id = ub.badge_id
    where ub.user_id = p.id
      and coalesce(ub.completed, true) = true
  ) user_badges on p.id is not null
  where event_row.organizer_id is not null

  union all

  select
    participant_rows.id,
    participant_rows.user_id,
    participant_rows.first_name,
    participant_rows.last_name_initial,
    participant_rows.avatar_url,
    participant_rows.age,
    participant_rows.total_points,
    participant_rows.bio,
    participant_rows.attended_events_count,
    participant_rows.badges,
    participant_rows.role,
    participant_rows.sort_order
  from participant_rows
  order by sort_order asc;
$$;

grant execute on function public.get_event_people_public(uuid) to anon;
grant execute on function public.get_event_people_public(uuid) to authenticated;
grant execute on function public.get_event_people_public(uuid) to service_role;

comment on function public.get_event_people_public(uuid) is
  'Public event people list. Bio is returned only to authenticated callers; anonymous callers receive null.';

notify pgrst, 'reload schema';
