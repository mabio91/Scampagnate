alter table public.profiles
  add column if not exists health_safety_status text,
  add column if not exists health_safety_notes text,
  add column if not exists emergency_medication_has boolean,
  add column if not exists emergency_medication_notes text,
  add column if not exists health_safety_help_notes text,
  add column if not exists health_safety_updated_at timestamptz;

comment on column public.profiles.health_safety_status is
  'Onboarding salute e sicurezza: none oppure has_info. Non usato per fit score, suggerimenti o blocchi.';
comment on column public.profiles.health_safety_notes is
  'Informazioni sanitarie o di sicurezza che lo staff puo consultare in caso di necessita.';
comment on column public.profiles.emergency_medication_has is
  'Indica se l''utente porta farmaci o dispositivi utili in emergenza.';
comment on column public.profiles.emergency_medication_notes is
  'Dettaglio di farmaci o dispositivi utili in emergenza.';
comment on column public.profiles.health_safety_help_notes is
  'Indicazioni opzionali su cosa fare o evitare in caso di necessita.';
comment on column public.profiles.health_safety_updated_at is
  'Ultimo aggiornamento dichiarato dall''utente per le informazioni di salute e sicurezza.';

do $$
begin
  alter table public.profiles
    add constraint profiles_health_safety_status_check
    check (
      health_safety_status is null
      or health_safety_status in ('none', 'has_info')
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_health_safety_notes_required_check
    check (
      health_safety_status is distinct from 'has_info'
      or nullif(btrim(coalesce(health_safety_notes, '')), '') is not null
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_emergency_medication_notes_required_check
    check (
      emergency_medication_has is distinct from true
      or nullif(btrim(coalesce(emergency_medication_notes, '')), '') is not null
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_health_safety_none_clears_details_check
    check (
      health_safety_status is distinct from 'none'
      or (
        health_safety_notes is null
        and emergency_medication_has is null
        and emergency_medication_notes is null
        and health_safety_help_notes is null
      )
    );
exception
  when duplicate_object then null;
end $$;
