CREATE TABLE IF NOT EXISTS public.admin_organizer_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  actor_app_role text NOT NULL CHECK (actor_app_role IN ('admin', 'organizer', 'admin,organizer')),
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  action_type text NOT NULL,
  source_schema text NOT NULL DEFAULT 'public',
  source_table text NOT NULL,
  source_record_id text,
  target_user_id uuid,
  event_id uuid,
  registration_id uuid,
  changed_columns text[] NOT NULL DEFAULT '{}'::text[],
  status_before text,
  status_after text,
  payment_status_before text,
  payment_status_after text,
  old_row jsonb,
  new_row jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_organizer_activity_log IS
  'Append-only audit trail for authenticated admin and organizer writes across public application tables.';

CREATE INDEX IF NOT EXISTS idx_admin_org_activity_actor_time
  ON public.admin_organizer_activity_log (actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_org_activity_event_time
  ON public.admin_organizer_activity_log (event_id, occurred_at DESC)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_org_activity_source_record
  ON public.admin_organizer_activity_log (source_table, source_record_id);

CREATE INDEX IF NOT EXISTS idx_admin_org_activity_action_time
  ON public.admin_organizer_activity_log (action_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_org_activity_metadata
  ON public.admin_organizer_activity_log USING gin (metadata);

ALTER TABLE public.admin_organizer_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin organizer activity log"
  ON public.admin_organizer_activity_log;
CREATE POLICY "Admins can view admin organizer activity log"
  ON public.admin_organizer_activity_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.admin_organizer_activity_log FROM anon;
REVOKE ALL ON public.admin_organizer_activity_log FROM authenticated;
GRANT SELECT ON public.admin_organizer_activity_log TO authenticated;
GRANT ALL ON public.admin_organizer_activity_log TO service_role;

CREATE OR REPLACE FUNCTION public.scamp_admin_organizer_activity_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_actor_is_organizer boolean := false;
  v_actor_app_role text;
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed_columns text[] := array[]::text[];
  v_source_record_id text;
  v_target_user_id uuid;
  v_event_id uuid;
  v_registration_id uuid;
  v_event_title text;
  v_event_date date;
  v_action_type text;
  v_metadata jsonb;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_actor_is_admin := public.has_role(v_actor_id, 'admin'::public.app_role);
  v_actor_is_organizer := public.has_role(v_actor_id, 'organizer'::public.app_role);

  IF NOT (v_actor_is_admin OR v_actor_is_organizer) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := public._scamp_sanitize_audit_row(to_jsonb(OLD));
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := public._scamp_sanitize_audit_row(to_jsonb(NEW));
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_changed_columns := public._scamp_changed_columns(v_old, v_new);
    IF COALESCE(array_length(v_changed_columns, 1), 0) = 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  v_row := COALESCE(v_new, v_old);
  v_actor_app_role := CASE
    WHEN v_actor_is_admin AND v_actor_is_organizer THEN 'admin,organizer'
    WHEN v_actor_is_admin THEN 'admin'
    ELSE 'organizer'
  END;

  v_source_record_id := COALESCE(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'event_id');
  v_target_user_id := public._scamp_extract_log_user_id(TG_TABLE_NAME, v_row);

  v_event_id := public._scamp_safe_uuid(v_row ->> 'event_id');
  IF TG_TABLE_NAME = 'events' THEN
    v_event_id := public._scamp_safe_uuid(v_row ->> 'id');
  END IF;

  v_registration_id := public._scamp_safe_uuid(v_row ->> 'registration_id');
  IF TG_TABLE_NAME = 'event_registrations' THEN
    v_registration_id := public._scamp_safe_uuid(v_row ->> 'id');
  END IF;

  IF v_event_id IS NOT NULL THEN
    SELECT e.title, e.date
    INTO v_event_title, v_event_date
    FROM public.events e
    WHERE e.id = v_event_id;
  END IF;

  v_action_type := public._scamp_activity_type(TG_TABLE_NAME, TG_OP, v_old, v_new);

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'actor_db_role', current_user,
    'event_title', v_event_title,
    'event_date', v_event_date,
    'transaction_id', txid_current(),
    'trigger', TG_NAME
  ));

  INSERT INTO public.admin_organizer_activity_log (
    actor_id,
    actor_app_role,
    operation,
    action_type,
    source_schema,
    source_table,
    source_record_id,
    target_user_id,
    event_id,
    registration_id,
    changed_columns,
    status_before,
    status_after,
    payment_status_before,
    payment_status_after,
    old_row,
    new_row,
    metadata
  )
  VALUES (
    v_actor_id,
    v_actor_app_role,
    TG_OP,
    v_action_type,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    v_source_record_id,
    v_target_user_id,
    v_event_id,
    v_registration_id,
    v_changed_columns,
    v_old ->> 'status',
    v_new ->> 'status',
    v_old ->> 'payment_status',
    v_new ->> 'payment_status',
    v_old,
    v_new,
    v_metadata
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Activity logging must never block production writes.
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.scamp_admin_organizer_activity_log_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scamp_admin_organizer_activity_log_trigger() FROM anon;
REVOKE ALL ON FUNCTION public.scamp_admin_organizer_activity_log_trigger() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scamp_admin_organizer_activity_log_trigger() TO service_role;

CREATE OR REPLACE FUNCTION public.scamp_install_admin_organizer_activity_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT IN (
        'admin_organizer_activity_log',
        'user_activity_log',
        'user_audit_log'
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS zz_scamp_admin_organizer_activity_log ON public.%I',
      v_table.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER zz_scamp_admin_organizer_activity_log
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.scamp_admin_organizer_activity_log_trigger()',
      v_table.table_name
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.scamp_install_admin_organizer_activity_triggers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scamp_install_admin_organizer_activity_triggers() FROM anon;
REVOKE ALL ON FUNCTION public.scamp_install_admin_organizer_activity_triggers() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scamp_install_admin_organizer_activity_triggers() TO service_role;

SELECT public.scamp_install_admin_organizer_activity_triggers();

DROP TRIGGER IF EXISTS zz_scamp_user_audit_log ON public.events;
CREATE TRIGGER zz_scamp_user_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public._scamp_user_audit_trigger();
