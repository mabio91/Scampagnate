


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "public"."account_status" AS ENUM (
    'Active',
    'Suspended',
    'Banned'
);


ALTER TYPE "public"."account_status" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'organizer',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."balance_payment_mode" AS ENUM (
    'online',
    'on_site'
);


ALTER TYPE "public"."balance_payment_mode" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'available',
    'full',
    'closed',
    'draft',
    'published',
    'cancelled',
    'past',
    'unpublished',
    'upcoming',
    'open',
    'rescheduled',
    'completed'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."event_visibility" AS ENUM (
    'public',
    'private',
    'hidden'
);


ALTER TYPE "public"."event_visibility" OWNER TO "postgres";


CREATE TYPE "public"."payment_type" AS ENUM (
    'free',
    'paid',
    'deposit',
    'location'
);


ALTER TYPE "public"."payment_type" OWNER TO "postgres";


CREATE TYPE "public"."registration_status" AS ENUM (
    'registered',
    'paid',
    'waitlist',
    'cancelled',
    'pending_approval',
    'attended',
    'no_show',
    'pending_payment',
    'deposit_paid'
);


ALTER TYPE "public"."registration_status" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "public"."_scamp_activity_group"("activity_type" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when activity_type like 'registration_%' or activity_type like 'waitlist_%' or activity_type in ('event_checkin','attendance_marked','no_show_marked') then 'registration'
    when activity_type like 'payment_%' or activity_type like 'refund_%' then 'payment'
    when activity_type like 'membership_%' then 'membership'
    when activity_type like 'mission_%' then 'mission'
    when activity_type like 'points_%' then 'points'
    when activity_type like 'reward_%' or activity_type like 'badge_%' then 'reward'
    when activity_type like 'notification_%' or activity_type like 'push_%' or activity_type like 'email_%' then 'communication'
    when activity_type like 'consent_%' then 'consent'
    when activity_type like 'profile_%' or activity_type like 'account_%' or activity_type like 'role_%' then 'account'
    when activity_type like 'event_%' then 'event'
    when activity_type like 'issue_%' then 'support'
    else 'system'
  end;
$$;


ALTER FUNCTION "public"."_scamp_activity_group"("activity_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_activity_title"("activity_type" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case activity_type
    when 'profile_created' then 'Profilo creato'
    when 'profile_updated' then 'Profilo aggiornato'
    when 'profile_deleted' then 'Profilo eliminato'
    when 'membership_activated' then 'Tessera attivata'
    when 'membership_status_changed' then 'Stato tessera aggiornato'
    when 'account_status_changed' then 'Stato account aggiornato'
    when 'registration_created' then 'Iscrizione creata'
    when 'registration_payment_pending' then 'Iscrizione in attesa di pagamento'
    when 'waitlist_joined' then 'Inserimento in lista d''attesa'
    when 'registration_cancelled' then 'Iscrizione cancellata'
    when 'registration_deleted' then 'Iscrizione eliminata'
    when 'registration_status_changed' then 'Stato iscrizione aggiornato'
    when 'event_checkin' then 'Check-in confermato'
    when 'attendance_marked' then 'Partecipazione confermata'
    when 'no_show_marked' then 'No-show registrato'
    when 'payment_confirmed' then 'Pagamento confermato'
    when 'payment_status_changed' then 'Stato pagamento aggiornato'
    when 'refund_status_changed' then 'Stato rimborso aggiornato'
    when 'refund_amount_changed' then 'Importo rimborso aggiornato'
    when 'notification_created' then 'Notifica creata'
    when 'notification_read' then 'Notifica letta'
    when 'points_awarded' then 'Punti assegnati'
    when 'points_deducted' then 'Punti detratti'
    when 'mission_completed' then 'Missione completata'
    when 'mission_progressed' then 'Missione avanzata'
    when 'reward_unlocked' then 'Ricompensa sbloccata'
    when 'reward_redeemed' then 'Ricompensa riscattata'
    when 'badge_unlocked' then 'Badge sbloccato'
    when 'event_saved' then 'Evento salvato'
    when 'event_unsaved' then 'Evento rimosso dai salvati'
    when 'consent_granted' then 'Consenso concesso'
    when 'consent_revoked' then 'Consenso revocato'
    when 'discount_code_used' then 'Codice sconto utilizzato'
    when 'activity_proposal_submitted' then 'Proposta attività inviata'
    when 'activity_proposal_status_changed' then 'Stato proposta aggiornato'
    when 'issue_created' then 'Segnalazione creata'
    when 'issue_resolved' then 'Segnalazione risolta'
    when 'push_device_registered' then 'Dispositivo notifiche registrato'
    when 'push_device_removed' then 'Dispositivo notifiche rimosso'
    when 'email_sent' then 'Email inviata'
    when 'role_assigned' then 'Ruolo assegnato'
    when 'role_changed' then 'Ruolo aggiornato'
    when 'role_removed' then 'Ruolo rimosso'
    when 'event_created' then 'Evento creato'
    when 'event_updated' then 'Evento aggiornato'
    when 'event_status_changed' then 'Stato evento aggiornato'
    when 'event_deleted' then 'Evento eliminato'
    else initcap(replace(activity_type, '_', ' '))
  end;
$$;


ALTER FUNCTION "public"."_scamp_activity_title"("activity_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_activity_type"("table_name" "text", "operation" "text", "old_row" "jsonb", "new_row" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_old_status text := old_row ->> 'status';
  v_new_status text := new_row ->> 'status';
  v_old_payment text := old_row ->> 'payment_status';
  v_new_payment text := new_row ->> 'payment_status';
  v_old_checked text := old_row ->> 'checked_in';
  v_new_checked text := new_row ->> 'checked_in';
  v_value numeric := public._scamp_safe_numeric(coalesce(new_row ->> 'value', old_row ->> 'value'));
begin
  if table_name = 'profiles' then
    if operation = 'INSERT' then return 'profile_created'; end if;
    if operation = 'DELETE' then return 'profile_deleted'; end if;
    if old_row ->> 'membership_status' is distinct from new_row ->> 'membership_status' then
      if lower(coalesce(new_row ->> 'membership_status', '')) = 'active' then return 'membership_activated'; end if;
      return 'membership_status_changed';
    end if;
    if old_row ->> 'account_status' is distinct from new_row ->> 'account_status' then return 'account_status_changed'; end if;
    if old_row ->> 'total_points' is distinct from new_row ->> 'total_points' then return 'profile_points_total_changed'; end if;
    return 'profile_updated';
  end if;

  if table_name = 'event_registrations' then
    if operation = 'INSERT' then
      if v_new_status = 'waitlist' then return 'waitlist_joined'; end if;
      if v_new_status = 'pending_payment' or v_new_payment = 'pending' then return 'registration_payment_pending'; end if;
      return 'registration_created';
    end if;
    if operation = 'DELETE' then return 'registration_deleted'; end if;
    if v_old_status is distinct from v_new_status and v_new_status = 'cancelled' then return 'registration_cancelled'; end if;
    if coalesce(v_old_checked, 'false') <> 'true' and v_new_checked = 'true' then return 'event_checkin'; end if;
    if v_old_status is distinct from v_new_status and v_new_status = 'attended' then return 'attendance_marked'; end if;
    if v_old_status is distinct from v_new_status and v_new_status = 'no_show' then return 'no_show_marked'; end if;
    if old_row ->> 'refund_status' is distinct from new_row ->> 'refund_status' then return 'refund_status_changed'; end if;
    if old_row ->> 'refund_amount' is distinct from new_row ->> 'refund_amount' and new_row ->> 'refund_amount' is not null then return 'refund_amount_changed'; end if;
    if v_old_payment is distinct from v_new_payment and v_new_payment in ('paid', 'deposit_paid') then return 'payment_confirmed'; end if;
    if v_old_payment is distinct from v_new_payment then return 'payment_status_changed'; end if;
    if v_old_status is distinct from v_new_status then return 'registration_status_changed'; end if;
    return 'registration_updated';
  end if;

  if table_name = 'notifications' then
    if operation = 'INSERT' then return 'notification_created'; end if;
    if operation = 'DELETE' then return 'notification_deleted'; end if;
    if coalesce(old_row ->> 'read', 'false') <> 'true' and new_row ->> 'read' = 'true' then return 'notification_read'; end if;
    return 'notification_updated';
  end if;

  if table_name = 'points_history' then
    if operation = 'INSERT' then
      if coalesce(v_value, 0) < 0 then return 'points_deducted'; end if;
      return 'points_awarded';
    end if;
    if operation = 'DELETE' then return 'points_history_deleted'; end if;
    return 'points_history_updated';
  end if;

  if table_name = 'user_mission_progress' then
    if operation = 'INSERT' then return 'mission_progress_created'; end if;
    if operation = 'DELETE' then return 'mission_progress_deleted'; end if;
    if coalesce(old_row ->> 'is_completed', 'false') <> 'true' and new_row ->> 'is_completed' = 'true' then return 'mission_completed'; end if;
    if old_row ->> 'current_value' is distinct from new_row ->> 'current_value' then return 'mission_progressed'; end if;
    return 'mission_progress_updated';
  end if;

  if table_name = 'user_mission_history' then
    if operation = 'INSERT' then return coalesce(new_row ->> 'event_type', 'mission_history_recorded'); end if;
    if operation = 'DELETE' then return 'mission_history_deleted'; end if;
    return 'mission_history_updated';
  end if;

  if table_name = 'user_rewards' then
    if operation = 'INSERT' then return 'reward_unlocked'; end if;
    if operation = 'DELETE' then return 'reward_deleted'; end if;
    if old_row ->> 'redeemed_at' is distinct from new_row ->> 'redeemed_at' and new_row ->> 'redeemed_at' is not null then return 'reward_redeemed'; end if;
    if v_old_status is distinct from v_new_status then return 'reward_status_changed'; end if;
    return 'reward_updated';
  end if;

  if table_name = 'user_badges' then
    if operation = 'INSERT' then return 'badge_unlocked'; end if;
    if operation = 'DELETE' then return 'badge_removed'; end if;
    if coalesce(old_row ->> 'completed', 'false') <> 'true' and new_row ->> 'completed' = 'true' then return 'badge_completed'; end if;
    return 'badge_updated';
  end if;

  if table_name = 'saved_events' then
    if operation = 'INSERT' then return 'event_saved'; end if;
    if operation = 'DELETE' then return 'event_unsaved'; end if;
    return 'saved_event_updated';
  end if;

  if table_name = 'user_consents' then
    if operation = 'INSERT' then
      if new_row ->> 'granted' = 'true' then return 'consent_granted'; end if;
      return 'consent_recorded';
    end if;
    if operation = 'DELETE' then return 'consent_deleted'; end if;
    if old_row ->> 'granted' is distinct from new_row ->> 'granted' then
      if new_row ->> 'granted' = 'true' then return 'consent_granted'; end if;
      return 'consent_revoked';
    end if;
    return 'consent_updated';
  end if;

  if table_name = 'discount_code_usage' then
    if operation = 'INSERT' then return 'discount_code_used'; end if;
    if operation = 'DELETE' then return 'discount_code_usage_deleted'; end if;
    return 'discount_code_usage_updated';
  end if;

  if table_name = 'activity_proposals' then
    if operation = 'INSERT' then return 'activity_proposal_submitted'; end if;
    if operation = 'DELETE' then return 'activity_proposal_deleted'; end if;
    if v_old_status is distinct from v_new_status then return 'activity_proposal_status_changed'; end if;
    return 'activity_proposal_updated';
  end if;

  if table_name = 'issues' then
    if operation = 'INSERT' then return 'issue_created'; end if;
    if operation = 'DELETE' then return 'issue_deleted'; end if;
    if v_old_status is distinct from v_new_status and v_new_status in ('resolved', 'closed') then return 'issue_resolved'; end if;
    if v_old_status is distinct from v_new_status then return 'issue_status_changed'; end if;
    return 'issue_updated';
  end if;

  if table_name in ('ios_device_tokens', 'push_subscriptions', 'onesignal_players') then
    if operation = 'INSERT' then return 'push_device_registered'; end if;
    if operation = 'DELETE' then return 'push_device_removed'; end if;
    return 'push_device_updated';
  end if;

  if table_name = 'email_send_log' then
    if operation = 'INSERT' then return 'email_sent'; end if;
    if operation = 'DELETE' then return 'email_send_log_deleted'; end if;
    return 'email_send_log_updated';
  end if;

  if table_name = 'user_roles' then
    if operation = 'INSERT' then return 'role_assigned'; end if;
    if operation = 'DELETE' then return 'role_removed'; end if;
    return 'role_changed';
  end if;

  if table_name = 'event_broadcasts' then
    if operation = 'INSERT' then return 'event_broadcast_created'; end if;
    if operation = 'DELETE' then return 'event_broadcast_deleted'; end if;
    return 'event_broadcast_updated';
  end if;

  if table_name = 'events' then
    if operation = 'INSERT' then return 'event_created'; end if;
    if operation = 'DELETE' then return 'event_deleted'; end if;
    if v_old_status is distinct from v_new_status then return 'event_status_changed'; end if;
    return 'event_updated';
  end if;

  if table_name = 'event_price_options' then
    if operation = 'INSERT' then return 'event_price_option_created'; end if;
    if operation = 'DELETE' then return 'event_price_option_deleted'; end if;
    return 'event_price_option_updated';
  end if;

  if table_name = 'event_meeting_points' then
    if operation = 'INSERT' then return 'event_meeting_point_created'; end if;
    if operation = 'DELETE' then return 'event_meeting_point_deleted'; end if;
    return 'event_meeting_point_updated';
  end if;

  if table_name = 'event_special_badges' then
    if operation = 'INSERT' then return 'event_special_badge_added'; end if;
    if operation = 'DELETE' then return 'event_special_badge_removed'; end if;
    return 'event_special_badge_updated';
  end if;

  if table_name = 'admin_action_log' then
    if operation = 'INSERT' then return 'admin_action_recorded'; end if;
    if operation = 'DELETE' then return 'admin_action_deleted'; end if;
    return 'admin_action_updated';
  end if;

  return lower(table_name || '_' || operation);
end;
$$;


ALTER FUNCTION "public"."_scamp_activity_type"("table_name" "text", "operation" "text", "old_row" "jsonb", "new_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_changed_columns"("old_row" "jsonb", "new_row" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with keys as (
    select key
    from jsonb_object_keys(coalesce(old_row, '{}'::jsonb) || coalesce(new_row, '{}'::jsonb)) as k(key)
  )
  select coalesce(array_agg(key order by key), array[]::text[])
  from keys
  where old_row -> key is distinct from new_row -> key;
$$;


ALTER FUNCTION "public"."_scamp_changed_columns"("old_row" "jsonb", "new_row" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_extract_log_user_id"("table_name" "text", "row_data" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_event_id uuid;
begin
  if row_data is null then
    return null;
  end if;

  v_user_id := public._scamp_safe_uuid(row_data ->> 'user_id');
  if v_user_id is not null then
    return v_user_id;
  end if;

  case table_name
    when 'profiles' then
      return public._scamp_safe_uuid(row_data ->> 'id');
    when 'activity_proposals' then
      return public._scamp_safe_uuid(row_data ->> 'proposer_id');
    when 'admin_action_log' then
      return public._scamp_safe_uuid(coalesce(row_data ->> 'user_id', row_data ->> 'admin_id'));
    when 'discount_codes' then
      return public._scamp_safe_uuid(coalesce(row_data ->> 'assigned_user_id', row_data ->> 'created_by'));
    when 'events' then
      return public._scamp_safe_uuid(row_data ->> 'organizer_id');
    when 'event_broadcasts' then
      return public._scamp_safe_uuid(row_data ->> 'sender_id');
    when 'ios_push_broadcasts' then
      return public._scamp_safe_uuid(row_data ->> 'created_by');
    when 'broadcast_message_templates' then
      return public._scamp_safe_uuid(row_data ->> 'created_by');
    when 'issues' then
      return public._scamp_safe_uuid(coalesce(row_data ->> 'reporter_id', row_data ->> 'resolved_by'));
    else
      null;
  end case;

  v_event_id := public._scamp_safe_uuid(row_data ->> 'event_id');
  if v_event_id is not null then
    select e.organizer_id into v_user_id
    from public.events e
    where e.id = v_event_id;

    if v_user_id is not null then
      return v_user_id;
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."_scamp_extract_log_user_id"("table_name" "text", "row_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_safe_numeric"("value" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::numeric;
exception when others then
  return null;
end;
$$;


ALTER FUNCTION "public"."_scamp_safe_numeric"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_safe_uuid"("value" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::uuid;
exception when others then
  return null;
end;
$$;


ALTER FUNCTION "public"."_scamp_safe_uuid"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_sanitize_audit_row"("row_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when row_data is null then null
    else row_data - array[
      'access_token',
      'refresh_token',
      'authorization',
      'password',
      'secret',
      'token',
      'device_token',
      'player_id',
      'endpoint',
      'keys',
      'auth',
      'p256dh',
      'otp',
      'otp_code',
      'verification_code',
      'code'
    ]
  end;
$$;


ALTER FUNCTION "public"."_scamp_sanitize_audit_row"("row_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_scamp_user_audit_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed_columns text[] := array[]::text[];
  v_user_id uuid;
  v_actor_id uuid;
  v_actor_role text;
  v_record_id text;
  v_event_id uuid;
  v_registration_id uuid;
  v_mission_id uuid;
  v_reward_id uuid;
  v_badge_id uuid;
  v_notification_id uuid;
  v_issue_id uuid;
  v_event_title text;
  v_event_date date;
  v_activity_type text;
  v_activity_group text;
  v_activity_title text;
  v_description text;
  v_amount numeric;
  v_audit_id uuid;
  v_metadata jsonb;
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    v_old := public._scamp_sanitize_audit_row(to_jsonb(OLD));
  end if;

  if TG_OP in ('INSERT', 'UPDATE') then
    v_new := public._scamp_sanitize_audit_row(to_jsonb(NEW));
  end if;

  v_row := coalesce(v_new, v_old);
  v_user_id := public._scamp_extract_log_user_id(TG_TABLE_NAME, v_row);

  if v_user_id is null then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  v_actor_id := auth.uid();
  v_actor_role := current_user;
  v_record_id := coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'event_id');
  v_changed_columns := public._scamp_changed_columns(v_old, v_new);

  v_event_id := public._scamp_safe_uuid(v_row ->> 'event_id');
  if TG_TABLE_NAME = 'events' then
    v_event_id := public._scamp_safe_uuid(v_row ->> 'id');
  end if;

  v_registration_id := case when TG_TABLE_NAME = 'event_registrations' then public._scamp_safe_uuid(v_row ->> 'id') else null end;
  v_mission_id := public._scamp_safe_uuid(v_row ->> 'mission_id');
  v_reward_id := case when TG_TABLE_NAME = 'user_rewards' then public._scamp_safe_uuid(v_row ->> 'id') else null end;
  v_badge_id := public._scamp_safe_uuid(coalesce(v_row ->> 'badge_id', case when TG_TABLE_NAME = 'user_badges' then v_row ->> 'id' end));
  v_notification_id := case when TG_TABLE_NAME = 'notifications' then public._scamp_safe_uuid(v_row ->> 'id') else null end;
  v_issue_id := case when TG_TABLE_NAME = 'issues' then public._scamp_safe_uuid(v_row ->> 'id') else null end;

  if v_event_id is not null then
    select e.title, e.date into v_event_title, v_event_date
    from public.events e
    where e.id = v_event_id;
  end if;

  v_activity_type := public._scamp_activity_type(TG_TABLE_NAME, TG_OP, v_old, v_new);
  v_activity_group := public._scamp_activity_group(v_activity_type);
  v_activity_title := public._scamp_activity_title(v_activity_type);

  v_amount := coalesce(
    public._scamp_safe_numeric(v_row ->> 'amount_paid'),
    public._scamp_safe_numeric(v_row ->> 'refund_amount'),
    public._scamp_safe_numeric(v_row ->> 'value'),
    public._scamp_safe_numeric(v_row ->> 'total_price_amount')
  );

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'changed_columns', to_jsonb(v_changed_columns),
    'event_title', v_event_title,
    'event_date', v_event_date,
    'operation', TG_OP,
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'record_id', v_record_id,
    'actor_role', v_actor_role,
    'transaction_id', txid_current()
  ));

  v_description := v_activity_title;
  if v_event_title is not null then
    v_description := v_description || ': ' || v_event_title;
  elsif v_row ? 'title' and nullif(v_row ->> 'title', '') is not null then
    v_description := v_description || ': ' || (v_row ->> 'title');
  elsif v_row ? 'type' and nullif(v_row ->> 'type', '') is not null then
    v_description := v_description || ' (' || (v_row ->> 'type') || ')';
  end if;

  begin
    insert into public.user_audit_log (
      schema_name,
      table_name,
      operation,
      record_id,
      user_id,
      actor_id,
      actor_role,
      source,
      changed_columns,
      old_row,
      new_row,
      metadata
    ) values (
      TG_TABLE_SCHEMA,
      TG_TABLE_NAME,
      TG_OP,
      v_record_id,
      v_user_id,
      v_actor_id,
      v_actor_role,
      'database_trigger',
      v_changed_columns,
      v_old,
      v_new,
      v_metadata
    ) returning id into v_audit_id;

    insert into public.user_activity_log (
      user_id,
      actor_id,
      actor_role,
      activity_type,
      activity_group,
      source_table,
      source_record_id,
      event_id,
      registration_id,
      mission_id,
      reward_id,
      badge_id,
      notification_id,
      issue_id,
      title,
      description,
      status_before,
      status_after,
      payment_status_before,
      payment_status_after,
      amount,
      metadata,
      audit_log_id
    ) values (
      v_user_id,
      v_actor_id,
      v_actor_role,
      v_activity_type,
      v_activity_group,
      TG_TABLE_NAME,
      v_record_id,
      v_event_id,
      v_registration_id,
      v_mission_id,
      v_reward_id,
      v_badge_id,
      v_notification_id,
      v_issue_id,
      v_activity_title,
      v_description,
      v_old ->> 'status',
      v_new ->> 'status',
      v_old ->> 'payment_status',
      v_new ->> 'payment_status',
      v_amount,
      v_metadata,
      v_audit_id
    );
  exception when others then
    -- Logging must never block the application transaction.
    null;
  end;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
exception when others then
  -- A defensive guard: if logging ever fails before the inner block, preserve app behavior.
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."_scamp_user_audit_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."_scamp_user_audit_trigger"() IS 'Passive user audit trigger. Inserts audit/activity rows and never blocks the source transaction on logging errors.';



CREATE OR REPLACE FUNCTION "public"."activate_membership"("user_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_id integer;
  current_membership_id integer;
  current_subscription_order integer;
  assigned_subscription_order integer;
  founding_badge_id uuid;
  qualifies_founding boolean := false;
BEGIN
  -- Keep membership_id and membership_subscription_order allocation serialized.
  PERFORM pg_advisory_xact_lock(640276513);

  SELECT membership_id, membership_subscription_order
  INTO current_membership_id, current_subscription_order
  FROM public.profiles
  WHERE id = user_id_param
  FOR UPDATE;

  IF current_membership_id IS NULL THEN
    next_id := public.next_available_membership_id();
  ELSE
    next_id := current_membership_id;
  END IF;

  IF current_subscription_order IS NULL THEN
    SELECT COALESCE(MAX(membership_subscription_order), 0) + 1
    INTO assigned_subscription_order
    FROM public.profiles;
  ELSE
    assigned_subscription_order := current_subscription_order;
  END IF;

  qualifies_founding := current_subscription_order IS NULL AND assigned_subscription_order <= 150;

  UPDATE public.profiles
  SET
    membership_id = next_id,
    membership_status = 'Active',
    membership_registration_date = CASE
      WHEN current_membership_id IS NULL THEN now()
      ELSE COALESCE(membership_registration_date, now())
    END,
    membership_year = extract(year FROM now())::integer,
    membership_subscription_order = COALESCE(current_subscription_order, assigned_subscription_order),
    is_founding_member = CASE
      WHEN qualifies_founding THEN true
      WHEN current_subscription_order IS NULL THEN false
      ELSE is_founding_member
    END
  WHERE id = user_id_param;

  SELECT id INTO founding_badge_id
  FROM public.badges
  WHERE name = 'Founding Member'
  LIMIT 1;

  IF founding_badge_id IS NOT NULL THEN
    IF qualifies_founding THEN
      PERFORM set_config('app.allow_founding_badge_assignment', 'true', true);

      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (user_id_param, founding_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    ELSE
      DELETE FROM public.user_badges
      WHERE user_id = user_id_param
        AND badge_id = founding_badge_id
        AND COALESCE(current_subscription_order, assigned_subscription_order) > 150;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."activate_membership"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_user_points"("p_user_id" "uuid", "p_type" "text", "p_value" integer, "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_description" "text" DEFAULT ''::"text", "p_admin_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
  VALUES (p_user_id, p_type, p_value, p_reference_id, p_description, p_admin_id);

  PERFORM public.recalculate_user_total_points(p_user_id);
END;
$$;


ALTER FUNCTION "public"."add_user_points"("p_user_id" "uuid", "p_type" "text", "p_value" integer, "p_reference_id" "uuid", "p_description" "text", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_assign_badge"("p_user_id" "uuid", "p_badge_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_badge_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can assign badges manually'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_badge_name
  FROM public.badges
  WHERE id = p_badge_id;

  IF v_badge_name IS NULL THEN
    RAISE EXCEPTION 'Badge not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_badges
    WHERE user_id = p_user_id
      AND badge_id = p_badge_id
  ) THEN
    RAISE EXCEPTION 'Questo utente ha gia questo badge'
      USING ERRCODE = '23505';
  END IF;

  IF v_badge_name = 'Founding Member' THEN
    PERFORM set_config('app.allow_founding_badge_assignment', 'true', true);
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id);

  IF v_badge_name = 'Founding Member' THEN
    UPDATE public.profiles
    SET
      is_founding_member = true,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_assign_badge"("p_user_id" "uuid", "p_badge_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_membership_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.membership_status = 'Active' AND (NEW.membership_id IS NULL) AND
     (OLD.membership_status IS DISTINCT FROM 'Active' OR OLD.membership_id IS NULL) THEN

    NEW.membership_id := public.next_available_membership_id();
    NEW.membership_registration_date := now();
    NEW.membership_year := extract(year from now())::integer;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_membership_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_badges_on_checkin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_attended_count int;
  v_badge record;
  v_cat_count int;
  v_marked_attended boolean;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.sport_level, '') LIKE 'manual:%' THEN
    RETURN NEW;
  END IF;

  v_marked_attended := (
    (NEW.checked_in = true AND (OLD.checked_in = false OR OLD.checked_in IS NULL))
    OR (NEW.status = 'attended' AND OLD.status IS DISTINCT FROM NEW.status)
  );

  IF v_marked_attended THEN
    v_user_id := NEW.user_id;
    v_attended_count := public.count_user_attended_events(v_user_id);

    FOR v_badge IN
      SELECT id
      FROM public.badges
      WHERE category IS NULL
        AND required_events <= v_attended_count
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (v_user_id, v_badge.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END LOOP;

    IF v_attended_count >= 5 THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      SELECT v_user_id, id
      FROM public.badges
      WHERE name = 'Scampagnatore Ufficiale'
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

    FOR v_badge IN
      SELECT b.id, b.category, b.required_events
      FROM public.badges b
      WHERE b.category IS NOT NULL
        AND b.category != 'special'
    LOOP
      v_cat_count := public.count_user_attended_events_in_category(v_user_id, v_badge.category);

      IF v_cat_count >= v_badge.required_events THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (v_user_id, v_badge.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END LOOP;

    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT v_user_id, esb.badge_id
    FROM public.event_special_badges esb
    JOIN public.badges b ON b.id = esb.badge_id
    WHERE esb.event_id = NEW.event_id
      AND b.category = 'special'
      AND b.name <> 'Founding Member'
    ON CONFLICT (user_id, badge_id) DO NOTHING;

    UPDATE public.profiles
    SET total_points = greatest(coalesce(total_points, 0), v_attended_count)
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."award_badges_on_checkin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_event_attendance_badges"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT DISTINCT
    p_user_id,
    b.id
  FROM public.events e
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.event_badges, '[]'::jsonb)) AS badge_entry
  CROSS JOIN LATERAL (
    SELECT (badge_entry ->> 'badge_id')::uuid AS badge_id
    WHERE jsonb_typeof(badge_entry) = 'object'
      AND badge_entry ->> 'type' = 'attendance_badge'
      AND COALESCE(badge_entry ->> 'badge_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) event_badge
  JOIN public.badges b
    ON b.id = event_badge.badge_id
   AND b.category = 'special'
  WHERE e.id = p_event_id
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$_$;


ALTER FUNCTION "public"."award_event_attendance_badges"("p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_mission_rewards"("p_user_id" "uuid", "p_mission_id" "uuid", "p_notify" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  reward_row record;
  mission_title text;
  badge_name text;
  coupon_id uuid;
  coupon_code text;
  coupon_prefix text;
  coupon_type text;
  coupon_value numeric;
  coupon_expires_at timestamptz;
  coupon_validity_days integer;
  inserted_id uuid;
  awarded_count integer := 0;
  reward_parts text[] := ARRAY[]::text[];
  v_reward_details jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR p_mission_id IS NULL THEN
    RETURN jsonb_build_object('awarded_count', 0, 'rewards', '[]'::jsonb);
  END IF;

  SELECT title INTO mission_title
  FROM public.missions
  WHERE id = p_mission_id;

  FOR reward_row IN
    SELECT mr.*
    FROM public.mission_rewards mr
    WHERE mr.mission_id = p_mission_id
    ORDER BY mr.sort_order ASC, mr.created_at ASC
  LOOP
    inserted_id := NULL;
    badge_name := NULL;
    coupon_id := NULL;
    coupon_code := NULL;

    IF reward_row.reward_kind = 'points' AND coalesce(reward_row.points_value, 0) > 0 THEN
      INSERT INTO public.points_history (user_id, type, value, description, reference_id)
      VALUES (
        p_user_id,
        'mission_reward',
        reward_row.points_value,
        coalesce(nullif(reward_row.title, ''), 'Ricompensa missione: ' || coalesce(mission_title, 'Missione')),
        reward_row.id
      )
      ON CONFLICT (user_id, type, reference_id)
        WHERE type = 'mission_reward' AND reference_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_id;

      IF inserted_id IS NOT NULL THEN
        UPDATE public.profiles
        SET total_points = coalesce(total_points, 0) + reward_row.points_value,
            updated_at = now()
        WHERE id = p_user_id;

        INSERT INTO public.user_rewards (
          user_id,
          mission_id,
          source_mission_reward_id,
          type,
          title,
          value,
          status
        )
        VALUES (
          p_user_id,
          p_mission_id,
          reward_row.id,
          'points',
          '+' || reward_row.points_value::text || ' punti',
          reward_row.points_value::text,
          'active'
        )
        ON CONFLICT (user_id, source_mission_reward_id)
          WHERE source_mission_reward_id IS NOT NULL
        DO NOTHING;

        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, '+' || reward_row.points_value::text || ' punti');
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'points',
          'points', reward_row.points_value,
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    ELSIF reward_row.reward_kind = 'badge' AND reward_row.badge_id IS NOT NULL THEN
      SELECT name INTO badge_name
      FROM public.badges
      WHERE id = reward_row.badge_id;

      INSERT INTO public.user_badges (user_id, badge_id, completed, completed_at, progress)
      VALUES (p_user_id, reward_row.badge_id, true, now(), 100)
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING id INTO inserted_id;

      INSERT INTO public.user_rewards (
        user_id,
        mission_id,
        source_mission_reward_id,
        type,
        title,
        value,
        status
      )
      VALUES (
        p_user_id,
        p_mission_id,
        reward_row.id,
        'badge',
        coalesce(nullif(reward_row.title, ''), badge_name, 'Badge missione'),
        badge_name,
        'active'
      )
      ON CONFLICT (user_id, source_mission_reward_id)
        WHERE source_mission_reward_id IS NOT NULL
      DO NOTHING;

      IF inserted_id IS NOT NULL THEN
        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, 'badge ' || coalesce(badge_name, 'missione'));
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'badge',
          'badge_id', reward_row.badge_id,
          'badge_name', badge_name,
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    ELSIF reward_row.reward_kind = 'coupon' THEN
      SELECT dc.discount_type, dc.discount_value, dc.expires_at
      INTO coupon_type, coupon_value, coupon_expires_at
      FROM public.discount_codes dc
      WHERE dc.id = reward_row.source_discount_code_id;

      IF coupon_type IS NULL THEN
        coupon_type := lower(coalesce(reward_row.coupon_config ->> 'discount_type', 'percentage'));
        IF coupon_type NOT IN ('percentage', 'fixed') THEN
          coupon_type := 'percentage';
        END IF;

        coupon_value := CASE
          WHEN coalesce(reward_row.coupon_config ->> 'discount_value', '') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (reward_row.coupon_config ->> 'discount_value')::numeric
          ELSE 10
        END;

        coupon_validity_days := CASE
          WHEN coalesce(reward_row.coupon_config ->> 'validity_days', '') ~ '^[0-9]+$'
            THEN (reward_row.coupon_config ->> 'validity_days')::integer
          ELSE NULL
        END;

        coupon_expires_at := CASE
          WHEN coupon_validity_days IS NOT NULL THEN now() + make_interval(days => coupon_validity_days)
          ELSE NULL
        END;
      END IF;

      coupon_prefix := upper(regexp_replace(coalesce(nullif(reward_row.coupon_config ->> 'code_prefix', ''), 'MISSION'), '[^A-Z0-9_-]', '', 'g'));
      IF coupon_prefix = '' THEN
        coupon_prefix := 'MISSION';
      END IF;
      coupon_code := coupon_prefix || '-' || upper(substr(md5(p_user_id::text || reward_row.id::text), 1, 8));

      INSERT INTO public.discount_codes (
        code,
        description,
        discount_type,
        discount_value,
        applies_to_all,
        max_uses,
        expires_at,
        is_active,
        assigned_user_id,
        is_single_use
      )
      VALUES (
        coupon_code,
        coalesce(nullif(reward_row.title, ''), 'Ricompensa missione: ' || coalesce(mission_title, 'Missione')),
        coupon_type,
        greatest(coalesce(coupon_value, 10), 0.01),
        true,
        1,
        coupon_expires_at,
        true,
        p_user_id,
        true
      )
      ON CONFLICT (code) DO UPDATE
        SET updated_at = public.discount_codes.updated_at
      RETURNING id, code INTO coupon_id, coupon_code;

      INSERT INTO public.user_rewards (
        user_id,
        mission_id,
        source_mission_reward_id,
        type,
        title,
        value,
        status,
        expiry_date
      )
      VALUES (
        p_user_id,
        p_mission_id,
        reward_row.id,
        'coupon',
        coalesce(nullif(reward_row.title, ''), 'Sconto missione'),
        coupon_code,
        'active',
        coupon_expires_at
      )
      ON CONFLICT (user_id, source_mission_reward_id)
        WHERE source_mission_reward_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_id;

      IF inserted_id IS NOT NULL THEN
        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, 'uno sconto');
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'coupon',
          'discount_code_id', coupon_id,
          'code', coupon_code,
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    ELSIF reward_row.reward_kind = 'physical' THEN
      INSERT INTO public.user_rewards (
        user_id,
        mission_id,
        source_mission_reward_id,
        type,
        title,
        value,
        status
      )
      VALUES (
        p_user_id,
        p_mission_id,
        reward_row.id,
        'physical',
        coalesce(nullif(reward_row.title, ''), 'Premio missione'),
        null,
        CASE WHEN coalesce(reward_row.approval_required, false) THEN 'pending' ELSE 'active' END
      )
      ON CONFLICT (user_id, source_mission_reward_id)
        WHERE source_mission_reward_id IS NOT NULL
      DO NOTHING
      RETURNING id INTO inserted_id;

      IF inserted_id IS NOT NULL THEN
        awarded_count := awarded_count + 1;
        reward_parts := array_append(reward_parts, coalesce(nullif(reward_row.title, ''), 'un premio'));
        v_reward_details := v_reward_details || jsonb_build_array(jsonb_build_object(
          'kind', 'physical',
          'source_mission_reward_id', reward_row.id
        ));
      END IF;
    END IF;
  END LOOP;

  UPDATE public.user_missions
  SET reward_details = CASE
        WHEN public.user_missions.reward_details IS NULL THEN jsonb_build_object('awarded_rewards', v_reward_details)
        ELSE public.user_missions.reward_details || jsonb_build_object('awarded_rewards', v_reward_details)
      END
  WHERE user_id = p_user_id
    AND mission_id = p_mission_id
    AND awarded_count > 0;

  IF p_notify AND awarded_count > 0 THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      p_user_id,
      'Missione completata',
      'Hai sbloccato ' || array_to_string(reward_parts, ', ') || '.',
      'success'
    );
  END IF;

  RETURN jsonb_build_object('awarded_count', awarded_count, 'rewards', v_reward_details);
END;
$_$;


ALTER FUNCTION "public"."award_mission_rewards"("p_user_id" "uuid", "p_mission_id" "uuid", "p_notify" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_mission_cycle_key"("p_mission_type" "text", "p_timezone" "text" DEFAULT 'Europe/Rome'::"text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE lower(coalesce(p_mission_type, ''))
    WHEN 'monthly' THEN to_char((timezone(coalesce(nullif(p_timezone, ''), 'Europe/Rome'), now()))::date, 'YYYY-MM')
    WHEN 'weekly' THEN to_char((timezone(coalesce(nullif(p_timezone, ''), 'Europe/Rome'), now()))::date, 'IYYY-"W"IW')
    ELSE 'lifetime'
  END;
$$;


ALTER FUNCTION "public"."compute_mission_cycle_key"("p_mission_type" "text", "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_event_active_participants"("p_event_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::integer
  FROM public.event_registrations er
  WHERE er.event_id = p_event_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status);
$$;


ALTER FUNCTION "public"."count_event_active_participants"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_event_option_active_participants"("p_option_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::integer
  FROM public.event_registrations er
  WHERE er.price_option_id = p_option_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status);
$$;


ALTER FUNCTION "public"."count_event_option_active_participants"("p_option_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_user_attended_events"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(DISTINCT er.event_id)::integer
  FROM public.event_registrations er
  WHERE er.user_id = p_user_id
    AND er.event_id IS NOT NULL
    AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
    AND (er.checked_in = true OR er.status = 'attended')
    AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended');
$$;


ALTER FUNCTION "public"."count_user_attended_events"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_user_attended_events_in_category"("p_user_id" "uuid", "p_category" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(DISTINCT er.event_id)::integer
  FROM public.event_registrations er
  JOIN public.events e ON e.id = er.event_id
  JOIN public.event_categories ec ON ec.id = e.category_id
  WHERE er.user_id = p_user_id
    AND er.event_id IS NOT NULL
    AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
    AND (er.checked_in = true OR er.status = 'attended')
    AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
    AND ec.name = p_category;
$$;


ALTER FUNCTION "public"."count_user_attended_events_in_category"("p_user_id" "uuid", "p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_option_availability"("p_event_id" "uuid") RETURNS TABLE("option_id" "uuid", "event_id" "uuid", "event_remaining" integer, "option_spots_taken" integer, "option_spots_total" integer, "option_remaining" integer, "real_remaining" integer, "is_bookable" boolean, "waitlist_enabled" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    epo.id AS option_id,
    epo.event_id,
    GREATEST(COALESCE(e.spots_total, 0) - COALESCE(e.spots_taken, 0), 0)::integer AS event_remaining,
    COALESCE(epo.spots_taken, 0)::integer AS option_spots_taken,
    CASE
      WHEN epo.has_dedicated_spots THEN epo.dedicated_spots
      ELSE NULL
    END AS option_spots_total,
    CASE
      WHEN epo.has_dedicated_spots AND epo.dedicated_spots IS NOT NULL
      THEN GREATEST(COALESCE(epo.dedicated_spots, 0) - COALESCE(epo.spots_taken, 0), 0)::integer
      ELSE NULL
    END AS option_remaining,
    CASE
      WHEN epo.has_dedicated_spots AND epo.dedicated_spots IS NOT NULL
      THEN LEAST(
        GREATEST(COALESCE(e.spots_total, 0) - COALESCE(e.spots_taken, 0), 0),
        GREATEST(COALESCE(epo.dedicated_spots, 0) - COALESCE(epo.spots_taken, 0), 0)
      )::integer
      ELSE GREATEST(COALESCE(e.spots_total, 0) - COALESCE(e.spots_taken, 0), 0)::integer
    END AS real_remaining,
    public.is_event_option_bookable(epo.event_id, epo.id) AS is_bookable,
    COALESCE(epo.waitlist_enabled, true) AS waitlist_enabled
  FROM public.event_price_options epo
  JOIN public.events e ON e.id = epo.event_id
  WHERE epo.event_id = p_event_id
  ORDER BY epo.sort_order ASC, epo.created_at ASC;
$$;


ALTER FUNCTION "public"."get_event_option_availability"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_participant_avatars"("p_event_id" "uuid") RETURNS TABLE("user_id" "uuid", "avatar_url" "text", "first_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    er.user_id,
    CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL ELSE p.avatar_url END AS avatar_url,
    CASE
      WHEN COALESCE(er.sport_level, '') LIKE 'manual:%'
        THEN COALESCE(NULLIF(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
      ELSE COALESCE(NULLIF(p.first_name, ''), 'Partecipante')
    END AS first_name
  FROM public.event_registrations er
  LEFT JOIN public.profiles p ON p.id = er.user_id
  WHERE er.event_id = p_event_id
    AND public.is_active_event_participant_status(er.status::text, er.payment_status)
    AND (
      (er.user_id IS NULL AND COALESCE(er.sport_level, '') LIKE 'manual:%')
      OR p.id IS NOT NULL
    )
  ORDER BY er.created_at ASC
  LIMIT 4;
$$;


ALTER FUNCTION "public"."get_event_participant_avatars"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_people_public"("p_event_id" "uuid") RETURNS TABLE("id" "text", "user_id" "uuid", "first_name" "text", "last_name_initial" "text", "avatar_url" "text", "age" integer, "total_points" integer, "role" "text", "sort_order" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH event_row AS (
    SELECT e.id, e.organizer_id, e.organizer_name
    FROM public.events e
    WHERE e.id = p_event_id
  ),
  participant_rows AS (
    SELECT
      er.id::text AS id,
      er.user_id,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%'
          THEN COALESCE(NULLIF(trim(split_part(replace(er.sport_level, 'manual:', ''), '|', 1)), ''), 'Partecipante')
        ELSE COALESCE(NULLIF(p.first_name, ''), 'Partecipante')
      END AS first_name,
      CASE
        WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        ELSE NULLIF(upper(left(COALESCE(p.last_name, ''), 1)), '')
      END AS last_name_initial,
      CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL ELSE p.avatar_url END AS avatar_url,
      CASE
        WHEN p.birth_date IS NULL OR COALESCE(er.sport_level, '') LIKE 'manual:%' THEN NULL
        ELSE date_part('year', age(p.birth_date))::integer
      END AS age,
      CASE WHEN COALESCE(er.sport_level, '') LIKE 'manual:%' THEN 0 ELSE COALESCE(p.total_points, 0) END AS total_points,
      'participant'::text AS role,
      (10 + row_number() OVER (ORDER BY er.created_at ASC))::integer AS sort_order
    FROM public.event_registrations er
    LEFT JOIN public.profiles p ON p.id = er.user_id
    WHERE er.event_id = p_event_id
      AND public.is_active_event_participant_status(er.status::text, er.payment_status)
      AND (
        (er.user_id IS NULL AND COALESCE(er.sport_level, '') LIKE 'manual:%')
        OR p.id IS NOT NULL
      )
  )
  SELECT
    ('organizer:' || COALESCE(p.id::text, event_row.organizer_id::text, event_row.id::text)) AS id,
    p.id AS user_id,
    COALESCE(NULLIF(p.first_name, ''), event_row.organizer_name, 'Organizzatore') AS first_name,
    NULLIF(upper(left(COALESCE(p.last_name, ''), 1)), '') AS last_name_initial,
    p.avatar_url,
    CASE WHEN p.birth_date IS NULL THEN NULL ELSE date_part('year', age(p.birth_date))::integer END AS age,
    COALESCE(p.total_points, 0) AS total_points,
    'organizer'::text AS role,
    0 AS sort_order
  FROM event_row
  LEFT JOIN public.profiles p ON p.id = event_row.organizer_id
  WHERE event_row.organizer_id IS NOT NULL

  UNION ALL

  SELECT
    participant_rows.id,
    participant_rows.user_id,
    participant_rows.first_name,
    participant_rows.last_name_initial,
    participant_rows.avatar_url,
    participant_rows.age,
    participant_rows.total_points,
    participant_rows.role,
    participant_rows.sort_order
  FROM participant_rows
  ORDER BY sort_order ASC;
$$;


ALTER FUNCTION "public"."get_event_people_public"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profile"("profile_id" "uuid") RETURNS TABLE("id" "uuid", "first_name" "text", "avatar_url" "text", "last_name_initial" "text", "total_points" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.first_name,
    p.avatar_url,
    CASE WHEN p.last_name IS NOT NULL AND p.last_name != '' THEN LEFT(p.last_name, 1) || '.' ELSE NULL END,
    p.total_points
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;


ALTER FUNCTION "public"."get_public_profile"("profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_profiles"("profile_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "first_name" "text", "avatar_url" "text", "last_name_initial" "text", "total_points" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.first_name,
    p.avatar_url,
    CASE WHEN p.last_name IS NOT NULL AND p.last_name != '' THEN LEFT(p.last_name, 1) || '.' ELSE NULL END,
    p.total_points
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids);
$$;


ALTER FUNCTION "public"."get_public_profiles"("profile_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_community_level"("p_points" integer) RETURNS TABLE("level_number" integer, "name" "text", "icon" "text", "color" "text", "min_points" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cl.level_number, cl.name, cl.icon, cl.color, cl.min_points
  FROM community_levels cl
  WHERE cl.min_points <= p_points
  ORDER BY cl.min_points DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_community_level"("p_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_event_attendance_badge_awards"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.checked_in = true OR NEW.status = 'attended' THEN
    PERFORM public.award_event_attendance_badges(NEW.event_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_event_attendance_badge_awards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_avatar_url text;
begin
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name := new.raw_user_meta_data->>'last_name';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_avatar_url := coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');

  -- If first_name is null (e.g. Google OAuth), extract from full_name.
  if v_first_name is null or v_first_name = '' then
    if v_full_name is not null and v_full_name != '' then
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := coalesce(v_last_name, nullif(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 2), ''));
    else
      v_first_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User');
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, phone, avatar_url, email)
  values (
    new.id,
    coalesce(v_first_name, 'User'),
    coalesce(v_last_name, ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    v_avatar_url,
    new.email
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_registration_mission_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL AND COALESCE(OLD.sport_level, '') NOT LIKE 'manual:%' THEN
      PERFORM public.sync_user_missions_for_user(OLD.user_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.user_id IS NOT NULL AND COALESCE(NEW.sport_level, '') NOT LIKE 'manual:%' THEN
    PERFORM public.sync_user_missions_for_user(NEW.user_id);
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.user_id IS DISTINCT FROM OLD.user_id
    AND OLD.user_id IS NOT NULL
    AND COALESCE(OLD.sport_level, '') NOT LIKE 'manual:%'
  THEN
    PERFORM public.sync_user_missions_for_user(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_registration_mission_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_discount_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE discount_codes SET times_used = times_used + 1, updated_at = now()
  WHERE id = NEW.discount_code_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_discount_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_scampagnate_edge_function"("p_function_name" "text", "p_body" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_base_url text := 'https://istotjnoqtrtthnyreyv.supabase.co/functions/v1/';
  v_anon_key text;
  v_internal_push_secret text;
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret
    INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_ANON_KEY'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;

  IF v_anon_key IS NULL OR length(v_anon_key) = 0 THEN
    RAISE EXCEPTION 'Missing Vault secret SUPABASE_ANON_KEY';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_anon_key
  );

  IF p_function_name = 'send-ios-push-notification' THEN
    SELECT decrypted_secret
      INTO v_internal_push_secret
    FROM vault.decrypted_secrets
    WHERE name = 'SCAMPAGNATE_INTERNAL_PUSH_SECRET'
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    IF v_internal_push_secret IS NULL OR length(v_internal_push_secret) = 0 THEN
      RAISE EXCEPTION 'Missing Vault secret SCAMPAGNATE_INTERNAL_PUSH_SECRET';
    END IF;

    v_headers := v_headers || jsonb_build_object(
      'x-scampagnate-internal-secret', v_internal_push_secret
    );
  END IF;

  SELECT net.http_post(
    url := v_base_url || p_function_name,
    headers := v_headers,
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;


ALTER FUNCTION "public"."invoke_scampagnate_edge_function"("p_function_name" "text", "p_body" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_event_participant_status"("p_status" "text", "p_payment_status" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(p_status, '') IN ('registered', 'deposit_paid', 'paid', 'attended', 'no_show')
    AND coalesce(p_payment_status, '') <> 'pending';
$$;


ALTER FUNCTION "public"."is_active_event_participant_status"("p_status" "text", "p_payment_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_closed_for_registration_status"("p_status" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT public.is_event_registration_open_status(p_status);
$$;


ALTER FUNCTION "public"."is_event_closed_for_registration_status"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_option_bookable"("p_event_id" "uuid", "p_price_option_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event record;
  v_event_remaining integer;
  v_option record;
BEGIN
  SELECT id, status, spots_total, spots_taken
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF v_event.id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v_event.status::text, '') IN ('draft', 'closed', 'cancelled', 'past', 'archived') THEN
    RETURN false;
  END IF;

  v_event_remaining := GREATEST(COALESCE(v_event.spots_total, 0) - COALESCE(v_event.spots_taken, 0), 0);
  IF v_event_remaining <= 0 THEN
    RETURN false;
  END IF;

  IF p_price_option_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.event_price_options epo
      WHERE epo.event_id = p_event_id
    ) THEN
      RETURN true;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.event_price_options epo
      WHERE epo.event_id = p_event_id
        AND (
          epo.has_dedicated_spots = false
          OR epo.dedicated_spots IS NULL
          OR GREATEST(COALESCE(epo.dedicated_spots, 0) - COALESCE(epo.spots_taken, 0), 0) > 0
        )
    );
  END IF;

  SELECT id, event_id, has_dedicated_spots, dedicated_spots, spots_taken
  INTO v_option
  FROM public.event_price_options
  WHERE id = p_price_option_id
    AND event_id = p_event_id;

  IF v_option.id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v_option.has_dedicated_spots, false) = false OR v_option.dedicated_spots IS NULL THEN
    RETURN true;
  END IF;

  RETURN GREATEST(COALESCE(v_option.dedicated_spots, 0) - COALESCE(v_option.spots_taken, 0), 0) > 0;
END;
$$;


ALTER FUNCTION "public"."is_event_option_bookable"("p_event_id" "uuid", "p_price_option_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_registration_open_status"("p_status" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(p_status, '') IN ('available', 'published', 'open');
$$;


ALTER FUNCTION "public"."is_event_registration_open_status"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_available_membership_id"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  next_id integer;
BEGIN
  -- Serialize membership number assignment so concurrent activations cannot pick the same gap.
  PERFORM pg_advisory_xact_lock(640276513);

  WITH max_id AS (
    SELECT greatest(COALESCE(MAX(membership_id), 0), 0) + 1 AS upper_bound
    FROM public.profiles
    WHERE membership_id IS NOT NULL
  ), candidates AS (
    SELECT generate_series(1, (SELECT upper_bound FROM max_id)) AS candidate_id
  )
  SELECT c.candidate_id
  INTO next_id
  FROM candidates c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.membership_id = c.candidate_id
  )
  ORDER BY c.candidate_id
  LIMIT 1;

  IF next_id IS NULL THEN
    RAISE EXCEPTION 'Could not find available membership ID';
  END IF;

  RETURN next_id;
END;
$$;


ALTER FUNCTION "public"."next_available_membership_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_event_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.date IS DISTINCT FROM NEW.date
    OR OLD.time IS DISTINCT FROM NEW.time
    OR OLD.location IS DISTINCT FROM NEW.location
    OR OLD.status IS DISTINCT FROM NEW.status
  THEN
    INSERT INTO public.notifications (user_id, type, title, message, event_id)
    SELECT er.user_id, 'event_update', 'Evento aggiornato', 'L''evento "' || NEW.title || '" e stato aggiornato. Controlla i dettagli.', NEW.id
    FROM public.event_registrations er
    WHERE er.event_id = NEW.id
      AND er.user_id IS NOT NULL
      AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
      AND er.status IN ('registered', 'deposit_paid', 'paid');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_event_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_issue_resolved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_on_issue_resolved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_proposal_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_title text;
  v_message text;
  v_type text;
BEGIN
  -- Only fire when status actually changes and proposer_id exists
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.proposer_id IS NOT NULL THEN
    CASE NEW.status
      WHEN 'reviewed' THEN
        v_type := 'proposal_reviewed';
        v_title := 'Proposta valutata';
        v_message := 'La tua proposta "' || NEW.activity_title || '" è stata valutata dal team.';
      WHEN 'archived' THEN
        v_type := 'proposal_archived';
        v_title := 'Proposta archiviata';
        v_message := 'La tua proposta "' || NEW.activity_title || '" è stata archiviata.';
      WHEN 'converted' THEN
        v_type := 'proposal_converted';
        v_title := 'Proposta approvata! 🎉';
        v_message := 'La tua proposta "' || NEW.activity_title || '" è stata convertita in un evento ufficiale!';
      ELSE
        RETURN NEW;
    END CASE;

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.proposer_id, v_type, v_title, v_message);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_proposal_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event_title text;
  v_notification_type text;
  v_title text;
  v_message text;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.sport_level, '') LIKE 'manual:%' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('registered', 'paid', 'deposit_paid') THEN
      v_notification_type := 'registration';
      v_title := 'Iscrizione confermata';
      v_message := 'Ti sei iscritto a "' || v_event_title || '"';
    ELSIF NEW.status = 'waitlist' THEN
      v_notification_type := 'waitlist';
      v_title := 'In lista d''attesa';
      v_message := 'Sei in lista d''attesa per "' || v_event_title || '"';
    END IF;

    IF v_title IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = NEW.user_id
        AND n.event_id = NEW.event_id
        AND n.type = v_notification_type
        AND n.created_at > now() - interval '5 minutes'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, v_notification_type, v_title, v_message, NEW.event_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'waitlist' AND NEW.status IN ('registered', 'paid', 'deposit_paid') THEN
      INSERT INTO public.notifications (user_id, type, title, message, event_id)
      VALUES (NEW.user_id, 'waitlist_promotion', 'Posto disponibile!', 'Un posto si e liberato per "' || v_event_title || '". Completa la prenotazione per confermare.', NEW.event_id);
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = NEW.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'payment'
          AND n.created_at > now() - interval '5 minutes'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, message, event_id)
        VALUES (NEW.user_id, 'payment', 'Pagamento confermato', 'Il pagamento per "' || v_event_title || '" e stato confermato.', NEW.event_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_manual_founding_member_badge_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  founding_badge_id uuid;
  allow_assignment text;
BEGIN
  SELECT id INTO founding_badge_id
  FROM public.badges
  WHERE name = 'Founding Member'
  LIMIT 1;

  IF founding_badge_id IS NULL THEN
    RETURN NEW;
  END IF;

  allow_assignment := current_setting('app.allow_founding_badge_assignment', true);

  IF NEW.badge_id = founding_badge_id AND COALESCE(allow_assignment, 'false') <> 'true' THEN
    RAISE EXCEPTION 'Founding Member badge can only be assigned automatically during membership activation';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_manual_founding_member_badge_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_from_waitlist"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_event_id uuid;
  v_spots_total int;
  v_spots_taken int;
  v_event_title text;
  v_event_status text;
  v_sold_out_mode text;
  v_waitlist_user record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_event_id := NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_id := OLD.event_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.status <> 'cancelled' OR OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT spots_total, spots_taken, title, status::text, coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode'
  INTO v_spots_total, v_spots_taken, v_event_title, v_event_status, v_sold_out_mode
  FROM public.events
  WHERE id = v_event_id;

  IF v_spots_taken < v_spots_total AND (v_event_status <> 'full' OR v_sold_out_mode = 'automatic') THEN
    UPDATE public.events
    SET
      status = 'published',
      additional_fields = coalesce(additional_fields, '{}'::jsonb) - 'sold_out_mode'
    WHERE id = v_event_id
      AND status = 'full'
      AND coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode' = 'automatic';

    FOR v_waitlist_user IN
      SELECT user_id
      FROM public.event_registrations
      WHERE event_id = v_event_id
        AND user_id IS NOT NULL
        AND COALESCE(sport_level, '') NOT LIKE 'manual:%'
        AND status = 'waitlist'
      ORDER BY created_at ASC
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = v_waitlist_user.user_id
          AND n.event_id = v_event_id
          AND n.type = 'waitlist_spot_available'
          AND n.created_at > now() - interval '5 minutes'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, message, event_id)
        VALUES (
          v_waitlist_user.user_id,
          'waitlist_spot_available',
          'Posto disponibile!',
          'Buone notizie: si e liberato un posto per "' || v_event_title || '". Puoi prenotarlo ora.',
          v_event_id
        );
      END IF;
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."promote_from_waitlist"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_user_total_points"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COALESCE(SUM(value), 0)::integer
  INTO v_total
  FROM public.points_history
  WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET
    total_points = v_total,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN v_total;
END;
$$;


ALTER FUNCTION "public"."recalculate_user_total_points"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_event_spots"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.events
  SET spots_taken = public.count_event_active_participants(p_event_id)
  WHERE id = p_event_id;

  UPDATE public.events
  SET
    status = 'full',
    additional_fields = coalesce(additional_fields, '{}'::jsonb)
      || jsonb_build_object('sold_out_mode', 'automatic')
  WHERE id = p_event_id
    AND spots_total > 0
    AND spots_taken >= spots_total
    AND public.is_event_registration_open_status(status::text);

  UPDATE public.events
  SET
    status = 'published',
    additional_fields = coalesce(additional_fields, '{}'::jsonb) - 'sold_out_mode'
  WHERE id = p_event_id
    AND spots_taken < spots_total
    AND status = 'full'
    AND coalesce(additional_fields, '{}'::jsonb) ->> 'sold_out_mode' = 'automatic';
END;
$$;


ALTER FUNCTION "public"."refresh_event_spots"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scamp_changed_columns"("old_data" "jsonb", "new_data" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(array_agg(k order by k), '{}'::text[])
  from jsonb_object_keys(coalesce(old_data, '{}'::jsonb) || coalesce(new_data, '{}'::jsonb)) as k
  where coalesce(old_data -> k, 'null'::jsonb) is distinct from coalesce(new_data -> k, 'null'::jsonb);
$$;


ALTER FUNCTION "public"."scamp_changed_columns"("old_data" "jsonb", "new_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scamp_user_activity_log_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  old_json jsonb := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;
  new_json jsonb := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;
  row_json jsonb := coalesce(new_json, old_json);
  changed_cols text[] := '{}'::text[];
  uid uuid;
  actor uuid;
  src_id text;
  grp text := 'system';
  typ text := TG_TABLE_NAME || '_' || lower(TG_OP);
  ttl text := TG_TABLE_NAME || ' ' || TG_OP;
  descr text;
  eid uuid;
  rid uuid;
  mid uuid;
  rewid uuid;
  bid uuid;
  nid uuid;
  before_status text;
  after_status text;
  before_pay text;
  after_pay text;
  amt numeric;
begin
  if TG_OP = 'UPDATE' then
    changed_cols := public.scamp_changed_columns(old_json, new_json);
    if coalesce(array_length(changed_cols, 1), 0) = 0 then
      return NEW;
    end if;
    if changed_cols <@ array['updated_at','last_seen_at','last_registered_at']::text[] then
      return NEW;
    end if;
  end if;

  src_id := row_json->>'id';

  uid := nullif(row_json->>'user_id','')::uuid;
  if uid is null and row_json ? 'proposer_id' then uid := nullif(row_json->>'proposer_id','')::uuid; end if;
  if uid is null and row_json ? 'reporter_id' then uid := nullif(row_json->>'reporter_id','')::uuid; end if;
  if uid is null and TG_TABLE_NAME = 'profiles' then uid := nullif(row_json->>'id','')::uuid; end if;
  if uid is null then return coalesce(NEW, OLD); end if;

  if row_json ? 'admin_id' then actor := nullif(row_json->>'admin_id','')::uuid; end if;
  if actor is null and row_json ? 'sender_id' then actor := nullif(row_json->>'sender_id','')::uuid; end if;
  if actor is null and row_json ? 'created_by' then actor := nullif(row_json->>'created_by','')::uuid; end if;

  if row_json ? 'event_id' then eid := nullif(row_json->>'event_id','')::uuid; end if;
  if TG_TABLE_NAME = 'event_registrations' then rid := nullif(row_json->>'id','')::uuid; end if;
  if row_json ? 'registration_id' then rid := coalesce(rid, nullif(row_json->>'registration_id','')::uuid); end if;
  if row_json ? 'mission_id' then mid := nullif(row_json->>'mission_id','')::uuid; end if;
  if TG_TABLE_NAME = 'user_rewards' then rewid := nullif(row_json->>'id','')::uuid; end if;
  if row_json ? 'badge_id' then bid := nullif(row_json->>'badge_id','')::uuid; end if;
  if TG_TABLE_NAME = 'notifications' then nid := nullif(row_json->>'id','')::uuid; end if;

  before_status := old_json->>'status';
  after_status := new_json->>'status';
  before_pay := old_json->>'payment_status';
  after_pay := new_json->>'payment_status';

  if row_json ? 'amount_paid' and nullif(row_json->>'amount_paid','') is not null then amt := (row_json->>'amount_paid')::numeric;
  elsif row_json ? 'amount' and nullif(row_json->>'amount','') is not null then amt := (row_json->>'amount')::numeric;
  elsif row_json ? 'refund_amount' and nullif(row_json->>'refund_amount','') is not null then amt := (row_json->>'refund_amount')::numeric;
  elsif row_json ? 'value' and (row_json->>'value') ~ '^-?[0-9]+(\.[0-9]+)?$' then amt := (row_json->>'value')::numeric;
  end if;

  if TG_TABLE_NAME = 'event_registrations' then
    grp := 'event';
    if TG_OP = 'INSERT' then typ := 'registration_created'; ttl := 'Iscrizione creata';
    elsif TG_OP = 'DELETE' then typ := 'registration_deleted'; ttl := 'Iscrizione eliminata';
    elsif before_status is distinct from after_status then
      typ := case when after_status = 'cancelled' then 'registration_cancelled' when after_status = 'attended' then 'attendance_confirmed' when after_status in ('paid','deposit_paid') then 'registration_paid_status' else 'registration_status_changed' end;
      ttl := case when after_status = 'cancelled' then 'Iscrizione cancellata' when after_status = 'attended' then 'Partecipazione confermata' when after_status in ('paid','deposit_paid') then 'Iscrizione pagata' else 'Stato iscrizione aggiornato' end;
    elsif before_pay is distinct from after_pay then
      typ := case when after_pay in ('paid','confirmed','succeeded') then 'payment_confirmed' when after_pay in ('failed','cancelled') then 'payment_failed' when after_pay = 'refunded' then 'payment_refunded' else 'payment_status_changed' end;
      ttl := case when after_pay in ('paid','confirmed','succeeded') then 'Pagamento confermato' when after_pay in ('failed','cancelled') then 'Pagamento non riuscito' when after_pay = 'refunded' then 'Pagamento rimborsato' else 'Stato pagamento aggiornato' end;
    elsif changed_cols && array['refund_amount','refund_status','refund_percentage']::text[] then typ := 'refund_updated'; ttl := 'Rimborso aggiornato';
    elsif changed_cols && array['meeting_point_id']::text[] then typ := 'meeting_point_changed'; ttl := 'Punto di ritrovo modificato';
    elsif changed_cols && array['price_option_id']::text[] then typ := 'price_option_changed'; ttl := 'Opzione prezzo modificata';
    elsif changed_cols && array['checked_in']::text[] then typ := 'checkin_updated'; ttl := 'Check-in aggiornato';
    else typ := 'registration_updated'; ttl := 'Iscrizione aggiornata'; end if;
  elsif TG_TABLE_NAME = 'discount_code_usage' then grp := 'payment'; typ := case TG_OP when 'INSERT' then 'coupon_used' when 'DELETE' then 'coupon_usage_deleted' else 'coupon_usage_updated' end; ttl := case TG_OP when 'INSERT' then 'Coupon utilizzato' when 'DELETE' then 'Uso coupon eliminato' else 'Uso coupon aggiornato' end;
  elsif TG_TABLE_NAME = 'points_history' then grp := 'points'; typ := case TG_OP when 'INSERT' then 'points_recorded' when 'DELETE' then 'points_deleted' else 'points_updated' end; ttl := case TG_OP when 'INSERT' then 'Punti registrati' when 'DELETE' then 'Punti eliminati' else 'Punti aggiornati' end;
  elsif TG_TABLE_NAME = 'user_badges' then grp := 'reward'; typ := case TG_OP when 'INSERT' then 'badge_earned' when 'DELETE' then 'badge_removed' else 'badge_updated' end; ttl := case TG_OP when 'INSERT' then 'Badge guadagnato' when 'DELETE' then 'Badge rimosso' else 'Badge aggiornato' end;
  elsif TG_TABLE_NAME in ('user_missions','user_mission_progress','user_mission_history') then grp := 'mission'; typ := case TG_OP when 'INSERT' then 'mission_progress_created' when 'DELETE' then 'mission_progress_deleted' else 'mission_progress_updated' end; ttl := case TG_OP when 'INSERT' then 'Missione/progresso creato' when 'DELETE' then 'Missione/progresso eliminato' else 'Avanzamento missione aggiornato' end;
  elsif TG_TABLE_NAME = 'user_rewards' then grp := 'reward'; typ := case TG_OP when 'INSERT' then 'reward_created' when 'DELETE' then 'reward_deleted' else 'reward_updated' end; ttl := case TG_OP when 'INSERT' then 'Ricompensa creata' when 'DELETE' then 'Ricompensa eliminata' else 'Ricompensa aggiornata' end;
  elsif TG_TABLE_NAME = 'notifications' then grp := 'communication'; typ := case TG_OP when 'INSERT' then 'notification_received' when 'DELETE' then 'notification_deleted' else 'notification_updated' end; ttl := coalesce(row_json->>'title', 'Notifica');
  elsif TG_TABLE_NAME = 'activity_proposals' then grp := 'proposal'; typ := case TG_OP when 'INSERT' then 'proposal_submitted' when 'DELETE' then 'proposal_deleted' else 'proposal_updated' end; ttl := case TG_OP when 'INSERT' then 'Proposta attività inviata' when 'DELETE' then 'Proposta attività eliminata' else 'Proposta attività aggiornata' end;
  elsif TG_TABLE_NAME = 'email_send_log' then grp := 'communication'; typ := case TG_OP when 'INSERT' then 'email_logged' when 'DELETE' then 'email_log_deleted' else 'email_updated' end; ttl := case TG_OP when 'INSERT' then 'Email registrata' when 'DELETE' then 'Log email eliminato' else 'Email aggiornata' end;
  elsif TG_TABLE_NAME = 'user_consents' then grp := 'account'; typ := case TG_OP when 'INSERT' then 'consent_recorded' when 'DELETE' then 'consent_deleted' else 'consent_updated' end; ttl := case TG_OP when 'INSERT' then 'Consenso registrato' when 'DELETE' then 'Consenso eliminato' else 'Consenso aggiornato' end;
  elsif TG_TABLE_NAME = 'admin_action_log' then grp := 'admin'; typ := coalesce(row_json->>'action','admin_action'); ttl := 'Azione admin';
  elsif TG_TABLE_NAME = 'saved_events' then grp := 'event'; typ := case TG_OP when 'INSERT' then 'event_saved' when 'DELETE' then 'saved_event_removed' else 'saved_event_updated' end; ttl := case TG_OP when 'INSERT' then 'Evento salvato' when 'DELETE' then 'Evento rimosso dai salvati' else 'Evento salvato aggiornato' end;
  elsif TG_TABLE_NAME = 'profiles' then grp := 'account'; typ := 'profile_updated'; ttl := 'Profilo aggiornato';
  elsif TG_TABLE_NAME in ('ios_device_tokens','onesignal_players') then grp := 'communication'; typ := case TG_OP when 'INSERT' then 'push_device_registered' when 'DELETE' then 'push_device_removed' else 'push_device_updated' end; ttl := case TG_OP when 'INSERT' then 'Dispositivo push registrato' when 'DELETE' then 'Dispositivo push rimosso' else 'Dispositivo push aggiornato' end;
  end if;

  descr := coalesce(row_json->>'message', row_json->>'description', row_json->>'title', ttl);

  insert into public.user_activity_log(
    user_id, actor_id, activity_type, activity_group, source_table, source_record_id, event_id, registration_id, mission_id, reward_id, badge_id, notification_id,
    title, description, status_before, status_after, payment_status_before, payment_status_after, amount, metadata
  ) values (
    uid, actor, typ, grp, TG_TABLE_NAME, src_id, eid, rid, mid, rewid, bid, nid,
    ttl, descr, before_status, after_status, before_pay, after_pay, amt,
    jsonb_strip_nulls(jsonb_build_object('operation', TG_OP, 'changed_columns', changed_cols, 'source', 'database_trigger', 'status', row_json->>'status', 'payment_status', row_json->>'payment_status', 'type', row_json->>'type', 'value', row_json->>'value', 'email_type', row_json->>'email_type', 'action', row_json->>'action', 'stripe_payment_intent_id', row_json->>'stripe_payment_intent_id'))
  );

  return coalesce(NEW, OLD);
end;
$_$;


ALTER FUNCTION "public"."scamp_user_activity_log_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_push_on_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.invoke_scampagnate_edge_function(
    'send-onesignal-notification',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'event_id', NEW.event_id,
      'type', NEW.type
    )
  );

  PERFORM public.invoke_scampagnate_edge_function(
    'send-ios-push-notification',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'notification_id', NEW.id,
      'title', NEW.title,
      'message', NEW.message,
      'event_id', NEW.event_id,
      'type', NEW.type
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."send_push_on_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_welcome_email_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.invoke_scampagnate_edge_function(
    'send-welcome-email',
    jsonb_build_object(
      'userId', NEW.id,
      'email', NEW.email,
      'firstName', NEW.first_name,
      'lastName', NEW.last_name
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."send_welcome_email_on_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_registration_added_by"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.added_by := auth.uid();
  ELSIF NEW.added_by IS NULL THEN
    NEW.added_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_event_registration_added_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_points_from_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_user_total_points(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_user_total_points(NEW.user_id);

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    PERFORM public.recalculate_user_total_points(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_points_from_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_registration_status_with_checkin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.checked_in = true
    AND NEW.status IN ('registered', 'paid', 'pending_payment', 'no_show') THEN
    NEW.status := 'attended';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_registration_status_with_checkin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_missions_for_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  mission_row record;
  progress_count integer;
  capped_progress integer;
  completed_flag boolean;
  cycle_key_value text;
  progress_row_id uuid;
  cycle_start_value timestamptz;
  cycle_end_value timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR mission_row IN
    SELECT
      m.id,
      m.type,
      m.title,
      m.target_value,
      m.target_action,
      m.category,
      m.category_filter,
      coalesce(nullif(m.timezone, ''), 'Europe/Rome') AS timezone,
      mc.event_filters
    FROM public.missions m
    LEFT JOIN LATERAL (
      SELECT event_filters
      FROM public.mission_conditions
      WHERE mission_id = m.id
      ORDER BY sort_order ASC
      LIMIT 1
    ) mc ON true
    WHERE m.is_active = true
      AND coalesce(m.is_archived, false) = false
      AND coalesce(m.status, 'active') NOT IN ('archived', 'draft')
    ORDER BY m.sort_order ASC, m.created_at ASC
  LOOP
    cycle_key_value := public.compute_mission_cycle_key(mission_row.type, mission_row.timezone);

    cycle_start_value := CASE lower(coalesce(mission_row.type, ''))
      WHEN 'monthly' THEN date_trunc('month', timezone(mission_row.timezone, now())) AT TIME ZONE mission_row.timezone
      WHEN 'weekly' THEN date_trunc('week', timezone(mission_row.timezone, now())) AT TIME ZONE mission_row.timezone
      ELSE now()
    END;

    cycle_end_value := CASE lower(coalesce(mission_row.type, ''))
      WHEN 'monthly' THEN (date_trunc('month', timezone(mission_row.timezone, now())) + interval '1 month') AT TIME ZONE mission_row.timezone
      WHEN 'weekly' THEN (date_trunc('week', timezone(mission_row.timezone, now())) + interval '1 week') AT TIME ZONE mission_row.timezone
      ELSE NULL
    END;

    IF mission_row.target_action = 'first_event_ever' THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      WHERE er.user_id = p_user_id
        AND er.event_id IS NOT NULL
        AND (er.checked_in = true OR er.status = 'attended')
        AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended');
    ELSIF mission_row.target_action IN ('event_attended', 'event_attendance', 'category_participation') THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      JOIN public.events e ON e.id = er.event_id
      LEFT JOIN public.event_categories ec ON ec.id = e.category_id
      WHERE er.user_id = p_user_id
        AND er.event_id IS NOT NULL
        AND (er.checked_in = true OR er.status = 'attended')
        AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
        AND (
          CASE lower(coalesce(mission_row.type, ''))
            WHEN 'monthly' THEN to_char(e.date, 'YYYY-MM') = cycle_key_value
            WHEN 'weekly' THEN to_char(e.date, 'IYYY-"W"IW') = cycle_key_value
            ELSE true
          END
        )
        AND (
          mission_row.target_action <> 'category_participation'
          OR (
            (
              coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)), 0) = 0
              AND coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)), 0) = 0
              AND coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '') = ''
            )
            OR ec.id IN (
              SELECT value::uuid
              FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)) AS value
            )
            OR ec.name IN (
              SELECT value
              FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)) AS value
            )
            OR ec.name = coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '')
            OR ec.name = ANY(coalesce(mission_row.category_filter, ARRAY[]::text[]))
          )
        );
    ELSE
      progress_count := 0;
    END IF;

    capped_progress := least(coalesce(progress_count, 0), greatest(coalesce(mission_row.target_value, 1), 1));
    completed_flag := capped_progress >= greatest(coalesce(mission_row.target_value, 1), 1);

    INSERT INTO public.user_missions (
      user_id,
      mission_id,
      progress,
      completed,
      completed_at,
      reward_details
    )
    VALUES (
      p_user_id,
      mission_row.id,
      capped_progress,
      completed_flag,
      CASE WHEN completed_flag THEN now() ELSE NULL END,
      NULL
    )
    ON CONFLICT (user_id, mission_id)
    DO UPDATE SET
      progress = EXCLUDED.progress,
      completed = EXCLUDED.completed,
      completed_at = CASE
        WHEN EXCLUDED.completed THEN coalesce(public.user_missions.completed_at, now())
        ELSE NULL
      END
    RETURNING id INTO progress_row_id;

    INSERT INTO public.user_mission_progress (
      user_id,
      mission_id,
      cycle_key,
      current_value,
      target_value,
      completion_count,
      is_completed,
      is_locked,
      is_expired,
      started_at,
      completed_at,
      last_progress_at,
      cycle_started_at,
      cycle_ends_at,
      state,
      legacy_user_mission_id
    )
    VALUES (
      p_user_id,
      mission_row.id,
      cycle_key_value,
      capped_progress,
      greatest(coalesce(mission_row.target_value, 1), 1),
      CASE WHEN completed_flag THEN 1 ELSE 0 END,
      completed_flag,
      false,
      false,
      now(),
      CASE WHEN completed_flag THEN now() ELSE NULL END,
      now(),
      cycle_start_value,
      cycle_end_value,
      '{}'::jsonb,
      progress_row_id
    )
    ON CONFLICT (user_id, mission_id, cycle_key)
    DO UPDATE SET
      current_value = EXCLUDED.current_value,
      target_value = EXCLUDED.target_value,
      completion_count = EXCLUDED.completion_count,
      is_completed = EXCLUDED.is_completed,
      is_locked = false,
      is_expired = false,
      completed_at = CASE
        WHEN EXCLUDED.is_completed THEN coalesce(public.user_mission_progress.completed_at, now())
        ELSE NULL
      END,
      last_progress_at = now(),
      cycle_started_at = coalesce(public.user_mission_progress.cycle_started_at, EXCLUDED.cycle_started_at),
      cycle_ends_at = EXCLUDED.cycle_ends_at,
      legacy_user_mission_id = EXCLUDED.legacy_user_mission_id;

    IF completed_flag THEN
      PERFORM public.award_mission_rewards(p_user_id, mission_row.id, true);
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."sync_user_missions_for_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_spots_taken"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_event_spots(NEW.event_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
      PERFORM public.refresh_event_spots(OLD.event_id);
    END IF;
    PERFORM public.refresh_event_spots(NEW.event_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_spots(OLD.event_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_spots_taken"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_discount_code"("p_code" "text", "p_event_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_discount record;
  v_already_used boolean;
  v_event_price numeric;
  v_final_price numeric;
BEGIN
  -- Find the code
  SELECT * INTO v_discount FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto non valido');
  END IF;

  -- Check not yet started
  IF v_discount.starts_at IS NOT NULL AND v_discount.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto non ancora attivo');
  END IF;

  -- Check expiration
  IF v_discount.expires_at IS NOT NULL AND v_discount.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto scaduto');
  END IF;

  -- Check max uses
  IF v_discount.max_uses IS NOT NULL AND v_discount.times_used >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto esaurito');
  END IF;

  -- Check user-specific assignment
  IF v_discount.assigned_user_id IS NOT NULL AND v_discount.assigned_user_id != p_user_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto non valido per il tuo account');
  END IF;

  -- Check single-use: if is_single_use, check if this user has used it for ANY event
  IF v_discount.is_single_use THEN
    IF EXISTS (
      SELECT 1 FROM discount_code_usage
      WHERE discount_code_id = v_discount.id AND user_id = p_user_id
    ) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Hai già utilizzato questo codice');
    END IF;
  END IF;

  -- Check if applies to this event
  IF NOT v_discount.applies_to_all AND v_discount.event_ids IS NOT NULL AND NOT (p_event_id = ANY(v_discount.event_ids)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice non valido per questo evento');
  END IF;

  -- Check if user already used this code for this event (non single-use case)
  IF NOT v_discount.is_single_use THEN
    SELECT EXISTS(
      SELECT 1 FROM discount_code_usage
      WHERE discount_code_id = v_discount.id AND user_id = p_user_id AND event_id = p_event_id
    ) INTO v_already_used;

    IF v_already_used THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Hai già utilizzato questo codice per questo evento');
    END IF;
  END IF;

  -- Get event price
  SELECT CASE
    WHEN payment_type = 'deposit' AND deposit IS NOT NULL THEN deposit
    WHEN payment_type = 'paid' THEN price
    ELSE 0
  END INTO v_event_price
  FROM events WHERE id = p_event_id;

  -- Calculate discounted price
  IF v_discount.discount_type = 'percentage' THEN
    v_final_price := GREATEST(0, v_event_price - (v_event_price * v_discount.discount_value / 100));
  ELSE
    v_final_price := GREATEST(0, v_event_price - v_discount.discount_value);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_code_id', v_discount.id,
    'discount_type', v_discount.discount_type,
    'discount_value', v_discount.discount_value,
    'original_price', v_event_price,
    'final_price', ROUND(v_final_price, 2),
    'description', v_discount.description
  );
END;
$$;


ALTER FUNCTION "public"."validate_discount_code"("p_code" "text", "p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposer_name" "text" DEFAULT ''::"text" NOT NULL,
    "proposer_id" "uuid",
    "activity_title" "text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "suggested_date" "text",
    "suggested_time" "text",
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "max_participants" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text",
    "location_label" "text",
    "category_id" "uuid"
);


ALTER TABLE "public"."activity_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_action_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_action_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "icon" "text" DEFAULT ''::"text" NOT NULL,
    "required_events" integer DEFAULT 1 NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requirement_type" "text",
    "requirement_value" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "location" "text" NOT NULL,
    "category_id" "uuid",
    "status" "public"."event_status" DEFAULT 'available'::"public"."event_status" NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "deposit" numeric(10,2),
    "payment_type" "public"."payment_type" DEFAULT 'free'::"public"."payment_type" NOT NULL,
    "image_url" "text",
    "difficulty" "text",
    "distance" "text",
    "elevation" "text",
    "duration" "text",
    "spots_total" integer DEFAULT 20 NOT NULL,
    "spots_taken" integer DEFAULT 0 NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "organizer_id" "uuid",
    "organizer_name" "text" DEFAULT 'Gruppo Scampagnate'::"text" NOT NULL,
    "cancellation_policy" "text",
    "equipment_list" "jsonb",
    "additional_fields" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reserved_spots" integer DEFAULT 0 NOT NULL,
    "visibility" "public"."event_visibility" DEFAULT 'public'::"public"."event_visibility" NOT NULL,
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb",
    "access_rules" "jsonb",
    "event_badges" "jsonb" DEFAULT '[]'::"jsonb",
    "location_label" "text",
    "balance_payment_mode" "public"."balance_payment_mode"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."gallery_images" IS 'Array of gallery images: [{ "url": "string", "order": number }]';



CREATE TABLE IF NOT EXISTS "public"."missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" DEFAULT 'one_time'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "target_value" integer DEFAULT 1 NOT NULL,
    "reward_points" integer DEFAULT 0 NOT NULL,
    "reward_badge_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "icon" "text" DEFAULT '🎯'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "reward_type" "text" DEFAULT 'points'::"text" NOT NULL,
    "reward_value" "text",
    "target_action" "text" DEFAULT 'event_attended'::"text" NOT NULL,
    "streak_count" integer,
    "reset_on_failure" boolean DEFAULT false NOT NULL,
    "starts_at" timestamp with time zone,
    "max_completions_per_user" integer,
    "notify_on_progress" boolean DEFAULT false NOT NULL,
    "auto_generate_coupon" boolean DEFAULT false NOT NULL,
    "category_filter" "text"[],
    "internal_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'visible'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "repeatable" boolean DEFAULT false NOT NULL,
    "mission_group" "text",
    "campaign_tag" "text",
    "campaign_id" "uuid",
    "timezone" "text" DEFAULT 'Europe/Rome'::"text" NOT NULL,
    "conditions_logic" "text" DEFAULT 'all'::"text" NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "icon_color" "text",
    "icon_background" "text",
    "banner_url" "text",
    "level" integer,
    "prerequisite_summary" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "definition_version" integer DEFAULT 2 NOT NULL,
    "ends_at" timestamp with time zone,
    "legacy_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "missions_conditions_logic_check" CHECK (("conditions_logic" = ANY (ARRAY['all'::"text", 'any'::"text"]))),
    CONSTRAINT "missions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'draft'::"text", 'archived'::"text"]))),
    CONSTRAINT "missions_type_check" CHECK (("type" = ANY (ARRAY['one_time'::"text", 'repeatable'::"text", 'daily'::"text", 'weekly'::"text", 'monthly'::"text", 'seasonal'::"text", 'progressive'::"text", 'streak'::"text"]))),
    CONSTRAINT "missions_visibility_check" CHECK (("visibility" = ANY (ARRAY['visible'::"text", 'hidden'::"text", 'secret'::"text"])))
);


ALTER TABLE "public"."missions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."missions"."type" IS 'Mission type: one_time, weekly, monthly, progressive, streak, category';



COMMENT ON COLUMN "public"."missions"."reward_type" IS 'Reward type: points, coupon, badge, physical';



COMMENT ON COLUMN "public"."missions"."target_action" IS 'Target action: event_attended, event_registered, category_attended, streak';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "total_points" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "preferences" "jsonb" DEFAULT '[]'::"jsonb",
    "trekking_experience" "text",
    "activity_frequency" "text",
    "experience_grade" integer,
    "membership_id" integer,
    "membership_status" "text" DEFAULT 'Inactive'::"text",
    "membership_registration_date" timestamp with time zone,
    "membership_year" integer,
    "account_status" "public"."account_status" DEFAULT 'Active'::"public"."account_status",
    "email" "text",
    "is_founding_member" boolean DEFAULT false NOT NULL,
    "self_level" "text",
    "has_car" "text",
    "interests" "text"[] DEFAULT '{}'::"text"[],
    "onboarding_completed" boolean DEFAULT false,
    "event_motivation" "text",
    "phone_verified" boolean DEFAULT false,
    "phone_verified_at" timestamp with time zone,
    "phone_verification_method" "text",
    "birth_date" "date",
    "membership_subscription_order" integer,
    "birth_place" "text",
    "residential_address" "text",
    "province_of_birth" "text",
    "city_of_residence" "text",
    "province_of_residence" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "activity_type" "text" NOT NULL,
    "activity_group" "text" DEFAULT 'system'::"text" NOT NULL,
    "source_table" "text",
    "source_record_id" "text",
    "event_id" "uuid",
    "registration_id" "uuid",
    "mission_id" "uuid",
    "reward_id" "uuid",
    "badge_id" "uuid",
    "notification_id" "uuid",
    "issue_id" "uuid",
    "title" "text",
    "description" "text",
    "status_before" "text",
    "status_after" "text",
    "payment_status_before" "text",
    "payment_status_after" "text",
    "amount" numeric,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "audit_log_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_activity_log" IS 'Semantic user activity timeline derived from user_audit_log trigger events. Safe for future app exposure after policy review.';



CREATE OR REPLACE VIEW "public"."admin_user_activity_timeline" WITH ("security_invoker"='true') AS
 SELECT "ual"."id",
    "ual"."occurred_at",
    "ual"."user_id",
    "p"."email",
    TRIM(BOTH FROM ((COALESCE("p"."first_name", ''::"text") || ' '::"text") || COALESCE("p"."last_name", ''::"text"))) AS "user_name",
    "ual"."activity_group",
    "ual"."activity_type",
    "ual"."title",
    "ual"."description",
    "ual"."source_table",
    "ual"."source_record_id",
    "ual"."event_id",
    "e"."title" AS "event_title",
    "e"."date" AS "event_date",
    "ual"."registration_id",
    "ual"."mission_id",
    "m"."title" AS "mission_title",
    "ual"."badge_id",
    "b"."name" AS "badge_name",
    "ual"."reward_id",
    "ual"."notification_id",
    "ual"."status_before",
    "ual"."status_after",
    "ual"."payment_status_before",
    "ual"."payment_status_after",
    "ual"."amount",
    "ual"."metadata"
   FROM (((("public"."user_activity_log" "ual"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "ual"."user_id")))
     LEFT JOIN "public"."events" "e" ON (("e"."id" = "ual"."event_id")))
     LEFT JOIN "public"."missions" "m" ON (("m"."id" = "ual"."mission_id")))
     LEFT JOIN "public"."badges" "b" ON (("b"."id" = "ual"."badge_id")));


ALTER VIEW "public"."admin_user_activity_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."broadcast_message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."broadcast_message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level_number" integer NOT NULL,
    "name" "text" NOT NULL,
    "min_points" integer DEFAULT 0 NOT NULL,
    "icon" "text" DEFAULT ''::"text" NOT NULL,
    "color" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content_html" "text" DEFAULT ''::"text" NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discount_code_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discount_code_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "original_price" numeric NOT NULL,
    "discounted_price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."discount_code_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discount_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric NOT NULL,
    "event_ids" "uuid"[],
    "applies_to_all" boolean DEFAULT false NOT NULL,
    "max_uses" integer,
    "times_used" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "starts_at" timestamp with time zone,
    "assigned_user_id" "uuid",
    "is_single_use" boolean DEFAULT false NOT NULL,
    "waives_service_fee" boolean DEFAULT false NOT NULL,
    CONSTRAINT "discount_codes_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "discount_codes_discount_value_check" CHECK (("discount_value" > (0)::numeric))
);


ALTER TABLE "public"."discount_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_send_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_type" "text" NOT NULL,
    "template_id" "uuid",
    "recipient_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "provider_response" "text",
    "retry_count" integer DEFAULT 0,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_send_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text" DEFAULT ''::"text" NOT NULL,
    "preview_text" "text" DEFAULT ''::"text",
    "body_html" "text" DEFAULT ''::"text" NOT NULL,
    "cta_label" "text" DEFAULT ''::"text",
    "cta_url" "text" DEFAULT ''::"text",
    "sender_name" "text" DEFAULT 'Scampagnate'::"text",
    "reply_to" "text" DEFAULT ''::"text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'transactional'::"text",
    CONSTRAINT "email_templates_type_check" CHECK (("type" = ANY (ARRAY['transactional'::"text", 'broadcast'::"text"])))
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_template_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_mandatory" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."equipment_template_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."equipment_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "message" "text" NOT NULL,
    "channel" "text" DEFAULT 'notification'::"text" NOT NULL,
    "recipients_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_meeting_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text" NOT NULL,
    "time" time without time zone NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."event_meeting_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_price_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eligible_group" "text" DEFAULT 'all'::"text" NOT NULL,
    "original_price" numeric,
    "promo_start" timestamp with time zone,
    "promo_end" timestamp with time zone,
    "is_promotional" boolean DEFAULT false NOT NULL,
    "payment_type" "public"."payment_type" DEFAULT 'paid'::"public"."payment_type" NOT NULL,
    "deposit_amount" numeric(10,2),
    "balance_amount" numeric(10,2),
    "balance_payment_mode" "public"."balance_payment_mode",
    "has_dedicated_spots" boolean DEFAULT false NOT NULL,
    "dedicated_spots" integer,
    "spots_taken" integer DEFAULT 0 NOT NULL,
    "waitlist_enabled" boolean DEFAULT true NOT NULL,
    CONSTRAINT "event_price_options_capacity_payment_check" CHECK ((("price" >= (0)::numeric) AND (COALESCE("deposit_amount", (0)::numeric) >= (0)::numeric) AND (COALESCE("balance_amount", (0)::numeric) >= (0)::numeric) AND (COALESCE("dedicated_spots", 0) >= 0) AND ("spots_taken" >= 0) AND (("payment_type" <> 'deposit'::"public"."payment_type") OR (COALESCE("deposit_amount", (0)::numeric) <= "price")) AND (("has_dedicated_spots" = false) OR ("dedicated_spots" IS NOT NULL))))
);


ALTER TABLE "public"."event_price_options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_price_options"."eligible_group" IS 'Who can see/use this price: all, members, badge:<id>, custom';



COMMENT ON COLUMN "public"."event_price_options"."original_price" IS 'Original price before discount (for strikethrough display)';



COMMENT ON COLUMN "public"."event_price_options"."promo_start" IS 'Start of promotional pricing window';



COMMENT ON COLUMN "public"."event_price_options"."promo_end" IS 'End of promotional pricing window';



COMMENT ON COLUMN "public"."event_price_options"."is_promotional" IS 'Whether this is a time-limited promotional price';



CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "meeting_point_id" "uuid",
    "status" "public"."registration_status" DEFAULT 'registered'::"public"."registration_status" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text",
    "sport_level" "text",
    "checked_in" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price_option_id" "uuid",
    "stripe_payment_intent_id" "text",
    "car_availability" "text",
    "additional_responses" "jsonb",
    "amount_paid" numeric(10,2),
    "cancellation_policy" "text",
    "service_fee_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "refund_percentage" integer,
    "refund_amount" numeric(10,2),
    "refund_status" "text",
    "cancelled_at" timestamp with time zone,
    "total_price_amount" numeric(10,2),
    "deposit_amount" numeric(10,2),
    "balance_due_amount" numeric(10,2),
    "balance_payment_mode" "public"."balance_payment_mode",
    "last_balance_reminder_sent_at" timestamp with time zone,
    "added_by" "uuid",
    CONSTRAINT "event_registrations_manual_identity_check" CHECK (((("user_id" IS NOT NULL) AND (COALESCE("sport_level", ''::"text") !~~ 'manual:%'::"text")) OR (("user_id" IS NULL) AND (COALESCE("sport_level", ''::"text") ~~ 'manual:%'::"text"))))
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_special_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_special_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ios_device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "installation_id" "text" NOT NULL,
    "device_token" "text" NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    "bundle_id" "text" DEFAULT 'com.fmcp.scampagnate.app'::"text" NOT NULL,
    "locale" "text",
    "app_version" "text",
    "device_model" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "last_registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ios_device_tokens_environment_check" CHECK (("environment" = ANY (ARRAY['sandbox'::"text", 'production'::"text"])))
);


ALTER TABLE "public"."ios_device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ios_push_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_by" "uuid",
    "target_count" integer DEFAULT 0 NOT NULL,
    "unique_user_count" integer DEFAULT 0 NOT NULL,
    "sent_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "expired_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "ios_push_broadcasts_environment_check" CHECK (("environment" = ANY (ARRAY['sandbox'::"text", 'production'::"text"]))),
    CONSTRAINT "ios_push_broadcasts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'completed'::"text", 'partial_failed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ios_push_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "reporter_id" "uuid",
    "reporter_name" "text" DEFAULT ''::"text" NOT NULL,
    "event_id" "uuid",
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolution_notes" "text",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."membership_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."membership_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."merch_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "name_it" "text",
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "description_it" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "image_url" "text",
    "badge" "text",
    "badge_it" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "whatsapp_number" "text" DEFAULT ''::"text",
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."merch_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "icon" "text" DEFAULT 'lucide:Sparkles'::"text" NOT NULL,
    "banner_url" "text",
    "color" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "reward_multiplier" numeric(6,2) DEFAULT 1.00 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mission_campaigns_reward_multiplier_check" CHECK (("reward_multiplier" > (0)::numeric))
);


ALTER TABLE "public"."mission_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_conditions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "target_action" "text" DEFAULT 'event_attendance'::"text" NOT NULL,
    "goal_metric" "text" DEFAULT 'count'::"text" NOT NULL,
    "goal_operator" "text" DEFAULT 'at_least'::"text" NOT NULL,
    "goal_value" integer DEFAULT 1 NOT NULL,
    "unique_by" "text" DEFAULT 'event'::"text" NOT NULL,
    "allow_repeat_same_event" boolean DEFAULT false NOT NULL,
    "period_unit" "text",
    "period_value" integer,
    "event_filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "user_filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "behavior_filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "failure_condition" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reset_policy" "text" DEFAULT 'none'::"text" NOT NULL,
    "push_notifications" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mission_conditions_goal_metric_check" CHECK (("goal_metric" = ANY (ARRAY['count'::"text", 'unique_events'::"text", 'unique_categories'::"text", 'unique_organizers'::"text", 'events_in_period'::"text", 'points_accumulated'::"text", 'first_completion'::"text", 'streak'::"text"]))),
    CONSTRAINT "mission_conditions_goal_operator_check" CHECK (("goal_operator" = ANY (ARRAY['at_least'::"text", 'exactly'::"text"]))),
    CONSTRAINT "mission_conditions_reset_policy_check" CHECK (("reset_policy" = ANY (ARRAY['none'::"text", 'full_reset'::"text", 'decrease_one'::"text", 'reset_streak_only'::"text", 'ignore_failure'::"text"]))),
    CONSTRAINT "mission_conditions_target_action_check" CHECK (("target_action" = ANY (ARRAY['event_registration'::"text", 'event_attendance'::"text", 'event_completed_without_cancellation'::"text", 'consecutive_participations'::"text", 'category_participation'::"text", 'first_event_ever'::"text", 'first_event_in_category'::"text", 'membership_purchased'::"text", 'profile_completed'::"text", 'manual_admin_completion'::"text", 'coupon_used'::"text", 'checkin_meeting_point'::"text", 'custom_action'::"text"]))),
    CONSTRAINT "mission_conditions_unique_by_check" CHECK (("unique_by" = ANY (ARRAY['action'::"text", 'event'::"text", 'category'::"text", 'organizer'::"text"])))
);


ALTER TABLE "public"."mission_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_prerequisites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "prerequisite_mission_id" "uuid" NOT NULL,
    "requirement_type" "text" DEFAULT 'completion'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "auto_archive_previous" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mission_prerequisites_requirement_type_check" CHECK (("requirement_type" = ANY (ARRAY['completion'::"text", 'unlock'::"text"])))
);


ALTER TABLE "public"."mission_prerequisites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "reward_kind" "text" DEFAULT 'points'::"text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "points_value" integer,
    "badge_id" "uuid",
    "source_discount_code_id" "uuid",
    "approval_required" boolean DEFAULT false NOT NULL,
    "visible_on_profile" boolean DEFAULT true NOT NULL,
    "badge_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "coupon_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "physical_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mission_rewards_reward_kind_check" CHECK (("reward_kind" = ANY (ARRAY['points'::"text", 'badge'::"text", 'coupon'::"text", 'physical'::"text"])))
);


ALTER TABLE "public"."mission_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" DEFAULT ''::"text" NOT NULL,
    "event_id" "uuid",
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onesignal_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "player_id" "text" NOT NULL,
    "device_type" "text" DEFAULT 'web'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."onesignal_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone_number" "text" NOT NULL,
    "otp_hash" "text" NOT NULL,
    "channel" "text" DEFAULT 'sms'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "verified" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."phone_otps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" DEFAULT ''::"text" NOT NULL,
    "label" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."points_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "value" integer NOT NULL,
    "reference_id" "uuid",
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."points_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trekking_difficulty_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level_number" integer NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text" DEFAULT ''::"text" NOT NULL,
    "color_primary" "text" DEFAULT '#000000'::"text" NOT NULL,
    "color_background" "text" DEFAULT '#F0F0F0'::"text" NOT NULL,
    "color_border" "text" DEFAULT '#CCCCCC'::"text" NOT NULL,
    "color_icon" "text" DEFAULT '#000000'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trekking_difficulty_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "schema_name" "text" DEFAULT 'public'::"text" NOT NULL,
    "table_name" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "record_id" "text",
    "user_id" "uuid",
    "actor_id" "uuid",
    "actor_role" "text",
    "source" "text" DEFAULT 'database_trigger'::"text" NOT NULL,
    "changed_columns" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "old_row" "jsonb",
    "new_row" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transaction_id" bigint DEFAULT "txid_current"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_audit_log_operation_check" CHECK (("operation" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text", 'BASELINE'::"text"])))
);


ALTER TABLE "public"."user_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_audit_log" IS 'Append-only technical audit log for user-related database changes. Written by passive triggers only.';



CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT true NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consent_type" "text" NOT NULL,
    "granted" boolean DEFAULT false NOT NULL,
    "version" "text",
    "granted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_consents_consent_type_check" CHECK (("consent_type" = ANY (ARRAY['terms'::"text", 'age'::"text", 'marketing'::"text", 'media'::"text"])))
);


ALTER TABLE "public"."user_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_mission_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "progress_id" "uuid",
    "event_type" "text" DEFAULT 'progress'::"text" NOT NULL,
    "delta" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'info'::"text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_mission_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_mission_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "cycle_key" "text" DEFAULT 'lifetime'::"text" NOT NULL,
    "current_value" integer DEFAULT 0 NOT NULL,
    "target_value" integer DEFAULT 1 NOT NULL,
    "completion_count" integer DEFAULT 0 NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "is_expired" boolean DEFAULT false NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "last_progress_at" timestamp with time zone,
    "cycle_started_at" timestamp with time zone,
    "cycle_ends_at" timestamp with time zone,
    "state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reward_details" "jsonb",
    "legacy_user_mission_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_mission_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reward_details" "jsonb"
);


ALTER TABLE "public"."user_missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid",
    "type" "text" DEFAULT 'points'::"text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "value" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "expiry_date" timestamp with time zone,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_mission_reward_id" "uuid"
);


ALTER TABLE "public"."user_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "public"."activity_proposals"
    ADD CONSTRAINT "activity_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_action_log"
    ADD CONSTRAINT "admin_action_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."broadcast_message_templates"
    ADD CONSTRAINT "broadcast_message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_levels"
    ADD CONSTRAINT "community_levels_level_number_key" UNIQUE ("level_number");



ALTER TABLE ONLY "public"."community_levels"
    ADD CONSTRAINT "community_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_pages"
    ADD CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_pages"
    ADD CONSTRAINT "content_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "discount_code_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discount_codes"
    ADD CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_template_key_key" UNIQUE ("template_key");



ALTER TABLE ONLY "public"."equipment_template_items"
    ADD CONSTRAINT "equipment_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_templates"
    ADD CONSTRAINT "equipment_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_broadcasts"
    ADD CONSTRAINT "event_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_meeting_points"
    ADD CONSTRAINT "event_meeting_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_price_options"
    ADD CONSTRAINT "event_price_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_special_badges"
    ADD CONSTRAINT "event_special_badges_event_id_badge_id_key" UNIQUE ("event_id", "badge_id");



ALTER TABLE ONLY "public"."event_special_badges"
    ADD CONSTRAINT "event_special_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ios_device_tokens"
    ADD CONSTRAINT "ios_device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ios_device_tokens"
    ADD CONSTRAINT "ios_device_tokens_user_installation_environment_key" UNIQUE ("user_id", "installation_id", "environment");



ALTER TABLE ONLY "public"."ios_push_broadcasts"
    ADD CONSTRAINT "ios_push_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."merch_products"
    ADD CONSTRAINT "merch_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_campaigns"
    ADD CONSTRAINT "mission_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_campaigns"
    ADD CONSTRAINT "mission_campaigns_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."mission_conditions"
    ADD CONSTRAINT "mission_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_prerequisites"
    ADD CONSTRAINT "mission_prerequisites_mission_id_prerequisite_mission_id_key" UNIQUE ("mission_id", "prerequisite_mission_id");



ALTER TABLE ONLY "public"."mission_prerequisites"
    ADD CONSTRAINT "mission_prerequisites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_rewards"
    ADD CONSTRAINT "mission_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onesignal_players"
    ADD CONSTRAINT "onesignal_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onesignal_players"
    ADD CONSTRAINT "onesignal_players_user_id_player_id_key" UNIQUE ("user_id", "player_id");



ALTER TABLE ONLY "public"."phone_otps"
    ADD CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_config"
    ADD CONSTRAINT "points_config_action_type_key" UNIQUE ("action_type");



ALTER TABLE ONLY "public"."points_config"
    ADD CONSTRAINT "points_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_history"
    ADD CONSTRAINT "points_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_membership_id_key" UNIQUE ("membership_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_membership_id_unique" UNIQUE ("membership_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."trekking_difficulty_levels"
    ADD CONSTRAINT "trekking_difficulty_levels_level_number_key" UNIQUE ("level_number");



ALTER TABLE ONLY "public"."trekking_difficulty_levels"
    ADD CONSTRAINT "trekking_difficulty_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discount_codes"
    ADD CONSTRAINT "unique_code" UNIQUE ("code");



ALTER TABLE ONLY "public"."user_activity_log"
    ADD CONSTRAINT "user_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_audit_log"
    ADD CONSTRAINT "user_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_badge_unique" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_consent_type_key" UNIQUE ("user_id", "consent_type");



ALTER TABLE ONLY "public"."user_mission_history"
    ADD CONSTRAINT "user_mission_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_user_id_mission_id_cycle_key_key" UNIQUE ("user_id", "mission_id", "cycle_key");



ALTER TABLE ONLY "public"."user_missions"
    ADD CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_missions"
    ADD CONSTRAINT "user_missions_user_id_mission_id_key" UNIQUE ("user_id", "mission_id");



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "event_registrations_event_user_unique" ON "public"."event_registrations" USING "btree" ("event_id", "user_id") WHERE (("user_id" IS NOT NULL) AND ("status" <> 'cancelled'::"public"."registration_status") AND (COALESCE("sport_level", ''::"text") !~~ 'manual:%'::"text"));



CREATE INDEX "idx_admin_action_log_user" ON "public"."admin_action_log" USING "btree" ("user_id");



CREATE INDEX "idx_discount_codes_assigned_user" ON "public"."discount_codes" USING "btree" ("assigned_user_id") WHERE ("assigned_user_id" IS NOT NULL);



CREATE INDEX "idx_ios_device_tokens_token_environment" ON "public"."ios_device_tokens" USING "btree" ("device_token", "environment");



CREATE INDEX "idx_ios_device_tokens_user_enabled" ON "public"."ios_device_tokens" USING "btree" ("user_id", "enabled", "environment");



CREATE INDEX "idx_ios_push_broadcasts_created_at" ON "public"."ios_push_broadcasts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mission_conditions_mission_id" ON "public"."mission_conditions" USING "btree" ("mission_id", "sort_order");



CREATE INDEX "idx_mission_prerequisites_mission_id" ON "public"."mission_prerequisites" USING "btree" ("mission_id", "sort_order");



CREATE INDEX "idx_mission_rewards_mission_id" ON "public"."mission_rewards" USING "btree" ("mission_id", "sort_order");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id", "read") WHERE ("read" = false);



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_points_history_user" ON "public"."points_history" USING "btree" ("user_id");



CREATE INDEX "idx_user_activity_log_event" ON "public"."user_activity_log" USING "btree" ("event_id");



CREATE INDEX "idx_user_activity_log_event_time" ON "public"."user_activity_log" USING "btree" ("event_id", "occurred_at" DESC) WHERE ("event_id" IS NOT NULL);



CREATE INDEX "idx_user_activity_log_group_type" ON "public"."user_activity_log" USING "btree" ("activity_group", "activity_type");



CREATE INDEX "idx_user_activity_log_metadata" ON "public"."user_activity_log" USING "gin" ("metadata");



CREATE INDEX "idx_user_activity_log_registration" ON "public"."user_activity_log" USING "btree" ("registration_id");



CREATE INDEX "idx_user_activity_log_source" ON "public"."user_activity_log" USING "btree" ("source_table", "source_record_id");



CREATE INDEX "idx_user_activity_log_type_time" ON "public"."user_activity_log" USING "btree" ("activity_type", "occurred_at" DESC);



CREATE INDEX "idx_user_activity_log_user_time" ON "public"."user_activity_log" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_user_audit_log_actor_time" ON "public"."user_audit_log" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "idx_user_audit_log_metadata" ON "public"."user_audit_log" USING "gin" ("metadata");



CREATE INDEX "idx_user_audit_log_table_record" ON "public"."user_audit_log" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_user_audit_log_user_time" ON "public"."user_audit_log" USING "btree" ("user_id", "occurred_at" DESC);



CREATE INDEX "idx_user_mission_history_mission_id" ON "public"."user_mission_history" USING "btree" ("mission_id", "created_at" DESC);



CREATE INDEX "idx_user_mission_history_user_id" ON "public"."user_mission_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_mission_progress_mission_id" ON "public"."user_mission_progress" USING "btree" ("mission_id");



CREATE INDEX "idx_user_mission_progress_user_id" ON "public"."user_mission_progress" USING "btree" ("user_id");



CREATE UNIQUE INDEX "points_history_user_mission_reward_key" ON "public"."points_history" USING "btree" ("user_id", "type", "reference_id") WHERE (("type" = 'mission_reward'::"text") AND ("reference_id" IS NOT NULL));



CREATE UNIQUE INDEX "profiles_membership_subscription_order_key" ON "public"."profiles" USING "btree" ("membership_subscription_order") WHERE ("membership_subscription_order" IS NOT NULL);



CREATE UNIQUE INDEX "user_rewards_user_source_mission_reward_key" ON "public"."user_rewards" USING "btree" ("user_id", "source_mission_reward_id") WHERE ("source_mission_reward_id" IS NOT NULL);



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "award_badges_trigger" AFTER UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."award_badges_on_checkin"();



CREATE OR REPLACE TRIGGER "notify_event_update_trigger" AFTER UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_event_update"();



CREATE OR REPLACE TRIGGER "notify_registration_trigger" AFTER INSERT OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_registration"();



CREATE OR REPLACE TRIGGER "on_discount_usage_insert" AFTER INSERT ON "public"."discount_code_usage" FOR EACH ROW EXECUTE FUNCTION "public"."increment_discount_usage"();



CREATE OR REPLACE TRIGGER "on_issue_resolved" AFTER UPDATE ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_issue_resolved"();



CREATE OR REPLACE TRIGGER "on_notification_send_push" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."send_push_on_notification"();



CREATE OR REPLACE TRIGGER "on_profile_created_send_welcome" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."send_welcome_email_on_signup"();



CREATE OR REPLACE TRIGGER "on_proposal_status_change" AFTER UPDATE ON "public"."activity_proposals" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_proposal_status_change"();



CREATE OR REPLACE TRIGGER "on_registration_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_spots_taken"();



CREATE OR REPLACE TRIGGER "promote_waitlist_on_cancel" AFTER DELETE OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."promote_from_waitlist"();



CREATE OR REPLACE TRIGGER "set_event_registration_added_by_trigger" BEFORE INSERT ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_registration_added_by"();



CREATE OR REPLACE TRIGGER "trg_auto_membership_id" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_membership_id"();



CREATE OR REPLACE TRIGGER "trg_prevent_manual_founding_member_badge_assignment" BEFORE INSERT OR UPDATE OF "badge_id" ON "public"."user_badges" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_manual_founding_member_badge_assignment"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_points_from_history" AFTER INSERT OR DELETE OR UPDATE ON "public"."points_history" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_points_from_history"();



CREATE OR REPLACE TRIGGER "trigger_event_attendance_badge_awards" AFTER INSERT OR UPDATE OF "checked_in", "status" ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_event_attendance_badge_awards"();



CREATE OR REPLACE TRIGGER "trigger_sync_registration_status_with_checkin" BEFORE INSERT OR UPDATE OF "checked_in" ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_registration_status_with_checkin"();



CREATE OR REPLACE TRIGGER "trigger_sync_user_missions_on_registration" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_registration_mission_sync"();



CREATE OR REPLACE TRIGGER "update_spots_taken_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_spots_taken"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."activity_proposals" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."admin_action_log" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."discount_code_usage" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."email_send_log" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."ios_device_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."onesignal_players" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."points_history" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."saved_events" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_badges" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_consents" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_mission_progress" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_missions" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_activity_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_rewards" FOR EACH ROW EXECUTE FUNCTION "public"."scamp_user_activity_log_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."broadcast_message_templates" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."discount_codes" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_meeting_points" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_price_options" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_special_badges" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."ios_push_broadcasts" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."issues" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."phone_otps" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_mission_history" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "zz_scamp_user_audit_log" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."_scamp_user_audit_trigger"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_proposals"
    ADD CONSTRAINT "activity_proposals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id");



ALTER TABLE ONLY "public"."activity_proposals"
    ADD CONSTRAINT "activity_proposals_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "discount_code_usage_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "discount_code_usage_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discount_code_usage"
    ADD CONSTRAINT "discount_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discount_codes"
    ADD CONSTRAINT "discount_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_send_log"
    ADD CONSTRAINT "email_send_log_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."equipment_template_items"
    ADD CONSTRAINT "equipment_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."equipment_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment_templates"
    ADD CONSTRAINT "equipment_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_broadcasts"
    ADD CONSTRAINT "event_broadcasts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_broadcasts"
    ADD CONSTRAINT "event_broadcasts_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_meeting_points"
    ADD CONSTRAINT "event_meeting_points_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_price_options"
    ADD CONSTRAINT "event_price_options_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_meeting_point_id_fkey" FOREIGN KEY ("meeting_point_id") REFERENCES "public"."event_meeting_points"("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_price_option_id_fkey" FOREIGN KEY ("price_option_id") REFERENCES "public"."event_price_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_special_badges"
    ADD CONSTRAINT "event_special_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_special_badges"
    ADD CONSTRAINT "event_special_badges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ios_device_tokens"
    ADD CONSTRAINT "ios_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ios_push_broadcasts"
    ADD CONSTRAINT "ios_push_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mission_conditions"
    ADD CONSTRAINT "mission_conditions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_prerequisites"
    ADD CONSTRAINT "mission_prerequisites_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_prerequisites"
    ADD CONSTRAINT "mission_prerequisites_prerequisite_mission_id_fkey" FOREIGN KEY ("prerequisite_mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_rewards"
    ADD CONSTRAINT "mission_rewards_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mission_rewards"
    ADD CONSTRAINT "mission_rewards_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_rewards"
    ADD CONSTRAINT "mission_rewards_source_discount_code_id_fkey" FOREIGN KEY ("source_discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."mission_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_reward_badge_id_fkey" FOREIGN KEY ("reward_badge_id") REFERENCES "public"."badges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phone_otps"
    ADD CONSTRAINT "phone_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_history"
    ADD CONSTRAINT "points_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_activity_log"
    ADD CONSTRAINT "user_activity_log_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "public"."user_audit_log"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_consents"
    ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_history"
    ADD CONSTRAINT "user_mission_history_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_history"
    ADD CONSTRAINT "user_mission_history_progress_id_fkey" FOREIGN KEY ("progress_id") REFERENCES "public"."user_mission_progress"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_mission_history"
    ADD CONSTRAINT "user_mission_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_legacy_user_mission_id_fkey" FOREIGN KEY ("legacy_user_mission_id") REFERENCES "public"."user_missions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_missions"
    ADD CONSTRAINT "user_missions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_missions"
    ADD CONSTRAINT "user_missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_source_mission_reward_id_fkey" FOREIGN KEY ("source_mission_reward_id") REFERENCES "public"."mission_rewards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_rewards"
    ADD CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



CREATE POLICY "Admins can delete broadcast templates" ON "public"."broadcast_message_templates" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete categories" ON "public"."event_categories" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete events" ON "public"."events" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete profiles" ON "public"."profiles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert broadcast templates" ON "public"."broadcast_message_templates" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert categories" ON "public"."event_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert email send log" ON "public"."email_send_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can insert events" ON "public"."events" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage action log" ON "public"."admin_action_log" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all discount codes" ON "public"."discount_codes" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage all price options" ON "public"."event_price_options" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage badges" ON "public"."badges" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage community levels" ON "public"."community_levels" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage content pages" ON "public"."content_pages" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage email templates" ON "public"."email_templates" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage equipment template items" ON "public"."equipment_template_items" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage equipment templates" ON "public"."equipment_templates" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage issues" ON "public"."issues" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage meeting points" ON "public"."event_meeting_points" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage mission campaigns" ON "public"."mission_campaigns" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage mission conditions" ON "public"."mission_conditions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage mission prerequisites" ON "public"."mission_prerequisites" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage mission rewards" ON "public"."mission_rewards" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage missions" ON "public"."missions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage notifications" ON "public"."notifications" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage platform settings" ON "public"."platform_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage points config" ON "public"."points_config" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage points history" ON "public"."points_history" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage products" ON "public"."merch_products" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage proposals" ON "public"."activity_proposals" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage registrations" ON "public"."event_registrations" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage roles" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage trekking difficulty levels" ON "public"."trekking_difficulty_levels" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage user badges" ON "public"."user_badges" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage user mission history" ON "public"."user_mission_history" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage user mission progress" ON "public"."user_mission_progress" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage user missions" ON "public"."user_missions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage user rewards" ON "public"."user_rewards" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update any event" ON "public"."events" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update broadcast templates" ON "public"."broadcast_message_templates" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update categories" ON "public"."event_categories" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all usage" ON "public"."discount_code_usage" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view email send log" ON "public"."email_send_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view iOS push broadcasts" ON "public"."ios_push_broadcasts" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view user activity log" ON "public"."user_activity_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view user audit log" ON "public"."user_audit_log" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Anyone can read active discount codes" ON "public"."discount_codes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can submit proposals" ON "public"."activity_proposals" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active mission campaigns" ON "public"."mission_campaigns" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active missions" ON "public"."missions" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active products" ON "public"."merch_products" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view badges" ON "public"."badges" FOR SELECT USING (true);



CREATE POLICY "Anyone can view categories" ON "public"."event_categories" FOR SELECT USING (true);



CREATE POLICY "Anyone can view community levels" ON "public"."community_levels" FOR SELECT USING (true);



CREATE POLICY "Anyone can view conditions of visible missions" ON "public"."mission_conditions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."missions" "m"
  WHERE (("m"."id" = "mission_conditions"."mission_id") AND ("m"."status" = 'active'::"text") AND (NOT "m"."is_archived") AND ("m"."visibility" <> 'secret'::"text")))));



CREATE POLICY "Anyone can view equipment template items" ON "public"."equipment_template_items" FOR SELECT USING (true);



CREATE POLICY "Anyone can view equipment templates" ON "public"."equipment_templates" FOR SELECT USING (true);



CREATE POLICY "Anyone can view event special badges" ON "public"."event_special_badges" FOR SELECT USING (true);



CREATE POLICY "Anyone can view events" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Anyone can view meeting points" ON "public"."event_meeting_points" FOR SELECT USING (true);



CREATE POLICY "Anyone can view mission prerequisites" ON "public"."mission_prerequisites" FOR SELECT USING (true);



CREATE POLICY "Anyone can view platform settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can view points config" ON "public"."points_config" FOR SELECT USING (true);



CREATE POLICY "Anyone can view price options" ON "public"."event_price_options" FOR SELECT USING (true);



CREATE POLICY "Anyone can view published pages" ON "public"."content_pages" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Anyone can view rewards of visible missions" ON "public"."mission_rewards" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."missions" "m"
  WHERE (("m"."id" = "mission_rewards"."mission_id") AND ("m"."status" = 'active'::"text") AND (NOT "m"."is_archived")))));



CREATE POLICY "Anyone can view trekking difficulty levels" ON "public"."trekking_difficulty_levels" FOR SELECT USING (true);



CREATE POLICY "Anyone can view user badges" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "Authenticated can view registrations" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Organizers and admins can view broadcast templates" ON "public"."broadcast_message_templates" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'organizer'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "Organizers can delete own events" ON "public"."events" FOR DELETE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can insert broadcasts for their events" ON "public"."event_broadcasts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_broadcasts"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can insert events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can insert registrations for own events" ON "public"."event_registrations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_registrations"."event_id") AND (("events"."organizer_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))))));



CREATE POLICY "Organizers can manage event special badges" ON "public"."event_special_badges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_special_badges"."event_id") AND (("e"."organizer_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."badges" "b" ON (("b"."id" = "event_special_badges"."badge_id")))
  WHERE (("e"."id" = "event_special_badges"."event_id") AND ("b"."category" = 'special'::"text") AND ("b"."name" <> 'Founding Member'::"text") AND (("e"."organizer_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))))));



CREATE POLICY "Organizers can manage meeting points" ON "public"."event_meeting_points" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_meeting_points"."event_id") AND ("events"."organizer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_meeting_points"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can manage own discount codes" ON "public"."discount_codes" TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND (NOT "applies_to_all"))) WITH CHECK ((("created_by" = "auth"."uid"()) AND (NOT "applies_to_all")));



CREATE POLICY "Organizers can manage own event price options" ON "public"."event_price_options" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_price_options"."event_id") AND ("events"."organizer_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_price_options"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update event registrations" ON "public"."event_registrations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_registrations"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update own events" ON "public"."events" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can view broadcasts for their events" ON "public"."event_broadcasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_broadcasts"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view event registrations" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "event_registrations"."event_id") AND ("events"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view participant profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."event_registrations" "er"
     JOIN "public"."events" "e" ON (("e"."id" = "er"."event_id")))
  WHERE (("er"."user_id" = "profiles"."id") AND ("e"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view proposals" ON "public"."activity_proposals" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'organizer'::"public"."app_role"));



CREATE POLICY "Service can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert badges" ON "public"."user_badges" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create issues" ON "public"."issues" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own OTPs" ON "public"."phone_otps" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own ios device tokens" ON "public"."ios_device_tokens" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own OTPs" ON "public"."phone_otps" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own consents" ON "public"."user_consents" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own ios device tokens" ON "public"."ios_device_tokens" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own usage" ON "public"."discount_code_usage" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage own onesignal players" ON "public"."onesignal_players" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own push subscriptions" ON "public"."push_subscriptions" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own saved events" ON "public"."saved_events" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own consents" ON "public"."user_consents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can register" ON "public"."event_registrations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own OTPs" ON "public"."phone_otps" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own ios device tokens" ON "public"."ios_device_tokens" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own optional consents" ON "public"."user_consents" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND ("consent_type" = ANY (ARRAY['marketing'::"text", 'media'::"text"])))) WITH CHECK ((("auth"."uid"() = "user_id") AND ("consent_type" = ANY (ARRAY['marketing'::"text", 'media'::"text"]))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own registration" ON "public"."event_registrations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own OTPs" ON "public"."phone_otps" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own ios device tokens" ON "public"."ios_device_tokens" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own issues" ON "public"."issues" FOR SELECT TO "authenticated" USING (("reporter_id" = "auth"."uid"()));



CREATE POLICY "Users can view own mission history" ON "public"."user_mission_history" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own mission progress" ON "public"."user_mission_progress" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own missions" ON "public"."user_missions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own points history" ON "public"."points_history" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own proposals" ON "public"."activity_proposals" FOR SELECT TO "authenticated" USING (("proposer_id" = "auth"."uid"()));



CREATE POLICY "Users can view own rewards" ON "public"."user_rewards" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own usage" ON "public"."discount_code_usage" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."activity_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_action_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."broadcast_message_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discount_code_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discount_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_send_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_template_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_meeting_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_price_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_special_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ios_device_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ios_push_broadcasts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."merch_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mission_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mission_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mission_prerequisites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mission_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onesignal_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_otps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trekking_difficulty_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_mission_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_mission_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_missions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Anyone can view event images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'event-images'::"text"));



CREATE POLICY "Authenticated users can delete avatars" ON "storage"."objects" FOR DELETE TO "authenticated" USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Authenticated users can update avatars" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Authenticated users can upload avatars" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Authenticated users can upload event images" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'event-images'::"text"));



CREATE POLICY "Public can view avatars" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Public read access to avatars" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Users can delete own avatar" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can delete own event images" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'event-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can update own avatar" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can update own event images" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'event-images'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can upload own avatar" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'avatars'::"text") AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



REVOKE ALL ON FUNCTION "public"."_scamp_activity_group"("activity_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_activity_group"("activity_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_activity_group"("activity_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_activity_group"("activity_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_activity_title"("activity_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_activity_title"("activity_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_activity_title"("activity_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_activity_title"("activity_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_activity_type"("table_name" "text", "operation" "text", "old_row" "jsonb", "new_row" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_activity_type"("table_name" "text", "operation" "text", "old_row" "jsonb", "new_row" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_activity_type"("table_name" "text", "operation" "text", "old_row" "jsonb", "new_row" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_activity_type"("table_name" "text", "operation" "text", "old_row" "jsonb", "new_row" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_changed_columns"("old_row" "jsonb", "new_row" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_changed_columns"("old_row" "jsonb", "new_row" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_changed_columns"("old_row" "jsonb", "new_row" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_changed_columns"("old_row" "jsonb", "new_row" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_extract_log_user_id"("table_name" "text", "row_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_extract_log_user_id"("table_name" "text", "row_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_extract_log_user_id"("table_name" "text", "row_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_extract_log_user_id"("table_name" "text", "row_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_safe_numeric"("value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_safe_numeric"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_safe_numeric"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_safe_numeric"("value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_safe_uuid"("value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_safe_uuid"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_safe_uuid"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_safe_uuid"("value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_sanitize_audit_row"("row_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_sanitize_audit_row"("row_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_sanitize_audit_row"("row_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_sanitize_audit_row"("row_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_scamp_user_audit_trigger"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_scamp_user_audit_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."_scamp_user_audit_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_scamp_user_audit_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."activate_membership"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activate_membership"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_membership"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_user_points"("p_user_id" "uuid", "p_type" "text", "p_value" integer, "p_reference_id" "uuid", "p_description" "text", "p_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_points"("p_user_id" "uuid", "p_type" "text", "p_value" integer, "p_reference_id" "uuid", "p_description" "text", "p_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_points"("p_user_id" "uuid", "p_type" "text", "p_value" integer, "p_reference_id" "uuid", "p_description" "text", "p_admin_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_assign_badge"("p_user_id" "uuid", "p_badge_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_assign_badge"("p_user_id" "uuid", "p_badge_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_assign_badge"("p_user_id" "uuid", "p_badge_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_assign_badge"("p_user_id" "uuid", "p_badge_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_generate_membership_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_membership_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_membership_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_badges_on_checkin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_badges_on_checkin"() TO "anon";
GRANT ALL ON FUNCTION "public"."award_badges_on_checkin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_badges_on_checkin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_event_attendance_badges"("p_event_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."award_event_attendance_badges"("p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_event_attendance_badges"("p_event_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_mission_rewards"("p_user_id" "uuid", "p_mission_id" "uuid", "p_notify" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_mission_rewards"("p_user_id" "uuid", "p_mission_id" "uuid", "p_notify" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."award_mission_rewards"("p_user_id" "uuid", "p_mission_id" "uuid", "p_notify" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_mission_rewards"("p_user_id" "uuid", "p_mission_id" "uuid", "p_notify" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_mission_cycle_key"("p_mission_type" "text", "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_mission_cycle_key"("p_mission_type" "text", "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_mission_cycle_key"("p_mission_type" "text", "p_timezone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."count_event_active_participants"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."count_event_active_participants"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_event_active_participants"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_event_active_participants"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."count_event_option_active_participants"("p_option_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."count_event_option_active_participants"("p_option_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_event_option_active_participants"("p_option_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_event_option_active_participants"("p_option_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."count_user_attended_events"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."count_user_attended_events"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_user_attended_events"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_user_attended_events"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."count_user_attended_events_in_category"("p_user_id" "uuid", "p_category" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."count_user_attended_events_in_category"("p_user_id" "uuid", "p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."count_user_attended_events_in_category"("p_user_id" "uuid", "p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_user_attended_events_in_category"("p_user_id" "uuid", "p_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_option_availability"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_option_availability"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_option_availability"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_participant_avatars"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_participant_avatars"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_participant_avatars"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_people_public"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_people_public"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_people_public"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_profile"("profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profile"("profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_profile"("profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_profiles"("profile_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_profiles"("profile_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_profiles"("profile_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_community_level"("p_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_community_level"("p_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_community_level"("p_points" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_event_attendance_badge_awards"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_event_attendance_badge_awards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_event_attendance_badge_awards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_registration_mission_sync"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_registration_mission_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_registration_mission_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_registration_mission_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_discount_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_discount_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_discount_usage"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invoke_scampagnate_edge_function"("p_function_name" "text", "p_body" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invoke_scampagnate_edge_function"("p_function_name" "text", "p_body" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_event_participant_status"("p_status" "text", "p_payment_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_event_participant_status"("p_status" "text", "p_payment_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_event_participant_status"("p_status" "text", "p_payment_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_event_closed_for_registration_status"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_event_closed_for_registration_status"("p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_option_bookable"("p_event_id" "uuid", "p_price_option_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_option_bookable"("p_event_id" "uuid", "p_price_option_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_option_bookable"("p_event_id" "uuid", "p_price_option_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_event_registration_open_status"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_event_registration_open_status"("p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_available_membership_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_available_membership_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."next_available_membership_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_available_membership_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_event_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_event_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_event_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_issue_resolved"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_issue_resolved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_issue_resolved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_proposal_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_proposal_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_proposal_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_manual_founding_member_badge_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_manual_founding_member_badge_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_manual_founding_member_badge_assignment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."promote_from_waitlist"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_from_waitlist"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_user_total_points"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_user_total_points"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_user_total_points"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_event_spots"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_event_spots"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."scamp_changed_columns"("old_data" "jsonb", "new_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."scamp_changed_columns"("old_data" "jsonb", "new_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."scamp_changed_columns"("old_data" "jsonb", "new_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."scamp_user_activity_log_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."scamp_user_activity_log_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."scamp_user_activity_log_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_push_on_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_push_on_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_push_on_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_welcome_email_on_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_welcome_email_on_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_welcome_email_on_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_registration_added_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_registration_added_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_registration_added_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_points_from_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_points_from_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_points_from_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_registration_status_with_checkin"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_registration_status_with_checkin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_registration_status_with_checkin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_user_missions_for_user"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_user_missions_for_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_missions_for_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_missions_for_user"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_spots_taken"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_spots_taken"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_spots_taken"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_spots_taken"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_discount_code"("p_code" "text", "p_event_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_discount_code"("p_code" "text", "p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_discount_code"("p_code" "text", "p_event_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."activity_proposals" TO "anon";
GRANT ALL ON TABLE "public"."activity_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."admin_action_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_action_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_action_log" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."missions" TO "anon";
GRANT ALL ON TABLE "public"."missions" TO "authenticated";
GRANT ALL ON TABLE "public"."missions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."user_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity_log" TO "service_role";



GRANT SELECT ON TABLE "public"."admin_user_activity_timeline" TO "authenticated";
GRANT SELECT ON TABLE "public"."admin_user_activity_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."broadcast_message_templates" TO "anon";
GRANT ALL ON TABLE "public"."broadcast_message_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."broadcast_message_templates" TO "service_role";



GRANT ALL ON TABLE "public"."community_levels" TO "anon";
GRANT ALL ON TABLE "public"."community_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."community_levels" TO "service_role";



GRANT ALL ON TABLE "public"."content_pages" TO "anon";
GRANT ALL ON TABLE "public"."content_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."content_pages" TO "service_role";



GRANT ALL ON TABLE "public"."discount_code_usage" TO "anon";
GRANT ALL ON TABLE "public"."discount_code_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."discount_code_usage" TO "service_role";



GRANT ALL ON TABLE "public"."discount_codes" TO "anon";
GRANT ALL ON TABLE "public"."discount_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."discount_codes" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_log" TO "anon";
GRANT ALL ON TABLE "public"."email_send_log" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_log" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_template_items" TO "anon";
GRANT ALL ON TABLE "public"."equipment_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_template_items" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_templates" TO "anon";
GRANT ALL ON TABLE "public"."equipment_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_templates" TO "service_role";



GRANT ALL ON TABLE "public"."event_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."event_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."event_categories" TO "anon";
GRANT ALL ON TABLE "public"."event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."event_categories" TO "service_role";



GRANT ALL ON TABLE "public"."event_meeting_points" TO "anon";
GRANT ALL ON TABLE "public"."event_meeting_points" TO "authenticated";
GRANT ALL ON TABLE "public"."event_meeting_points" TO "service_role";



GRANT ALL ON TABLE "public"."event_price_options" TO "anon";
GRANT ALL ON TABLE "public"."event_price_options" TO "authenticated";
GRANT ALL ON TABLE "public"."event_price_options" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."event_special_badges" TO "anon";
GRANT ALL ON TABLE "public"."event_special_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."event_special_badges" TO "service_role";



GRANT ALL ON TABLE "public"."ios_device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."ios_device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."ios_device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."ios_push_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."ios_push_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."ios_push_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."issues" TO "anon";
GRANT ALL ON TABLE "public"."issues" TO "authenticated";
GRANT ALL ON TABLE "public"."issues" TO "service_role";



GRANT ALL ON SEQUENCE "public"."membership_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."membership_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."membership_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."merch_products" TO "anon";
GRANT ALL ON TABLE "public"."merch_products" TO "authenticated";
GRANT ALL ON TABLE "public"."merch_products" TO "service_role";



GRANT ALL ON TABLE "public"."mission_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."mission_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."mission_conditions" TO "anon";
GRANT ALL ON TABLE "public"."mission_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."mission_prerequisites" TO "anon";
GRANT ALL ON TABLE "public"."mission_prerequisites" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_prerequisites" TO "service_role";



GRANT ALL ON TABLE "public"."mission_rewards" TO "anon";
GRANT ALL ON TABLE "public"."mission_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."onesignal_players" TO "anon";
GRANT ALL ON TABLE "public"."onesignal_players" TO "authenticated";
GRANT ALL ON TABLE "public"."onesignal_players" TO "service_role";



GRANT ALL ON TABLE "public"."phone_otps" TO "anon";
GRANT ALL ON TABLE "public"."phone_otps" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_otps" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."points_config" TO "anon";
GRANT ALL ON TABLE "public"."points_config" TO "authenticated";
GRANT ALL ON TABLE "public"."points_config" TO "service_role";



GRANT ALL ON TABLE "public"."points_history" TO "anon";
GRANT ALL ON TABLE "public"."points_history" TO "authenticated";
GRANT ALL ON TABLE "public"."points_history" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."saved_events" TO "anon";
GRANT ALL ON TABLE "public"."saved_events" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_events" TO "service_role";



GRANT ALL ON TABLE "public"."trekking_difficulty_levels" TO "anon";
GRANT ALL ON TABLE "public"."trekking_difficulty_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."trekking_difficulty_levels" TO "service_role";



GRANT ALL ON TABLE "public"."user_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."user_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."user_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_consents" TO "anon";
GRANT ALL ON TABLE "public"."user_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_consents" TO "service_role";



GRANT ALL ON TABLE "public"."user_mission_history" TO "anon";
GRANT ALL ON TABLE "public"."user_mission_history" TO "authenticated";
GRANT ALL ON TABLE "public"."user_mission_history" TO "service_role";



GRANT ALL ON TABLE "public"."user_mission_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_mission_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_mission_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_missions" TO "anon";
GRANT ALL ON TABLE "public"."user_missions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_missions" TO "service_role";



GRANT ALL ON TABLE "public"."user_rewards" TO "anon";
GRANT ALL ON TABLE "public"."user_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."user_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




