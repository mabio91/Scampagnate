CREATE TABLE IF NOT EXISTS public.prepaid_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text,
  birth_date date,
  birth_place text,
  province_of_birth text,
  residential_address text,
  city_of_residence text,
  province_of_residence text,
  payment_date date,
  membership_year integer NOT NULL DEFAULT extract(year FROM now())::integer,
  status text NOT NULL DEFAULT 'pending_user',
  matched_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  import_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_batch_label text,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at timestamp with time zone,
  manually_assigned_at timestamp with time zone,
  review_note text,
  error_message text,
  source_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prepaid_memberships_status_check CHECK (
    status = ANY (ARRAY['pending_user', 'activated', 'needs_review', 'duplicate', 'error'])
  ),
  CONSTRAINT prepaid_memberships_year_check CHECK (membership_year BETWEEN 2020 AND 2100)
);

CREATE UNIQUE INDEX IF NOT EXISTS prepaid_memberships_email_year_key
  ON public.prepaid_memberships (email, membership_year);

CREATE INDEX IF NOT EXISTS prepaid_memberships_status_idx
  ON public.prepaid_memberships (status);

CREATE INDEX IF NOT EXISTS prepaid_memberships_matched_user_id_idx
  ON public.prepaid_memberships (matched_user_id);

CREATE OR REPLACE FUNCTION public._scamp_normalize_email(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(lower(trim(value)), '')
$$;

CREATE OR REPLACE FUNCTION public._scamp_safe_date(value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF value IS NULL OR trim(value) = '' THEN
    RETURN NULL;
  END IF;

  RETURN trim(value)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_prepaid_membership_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email := public._scamp_normalize_email(NEW.email);
  NEW.first_name := COALESCE(NULLIF(trim(NEW.first_name), ''), '');
  NEW.last_name := COALESCE(NULLIF(trim(NEW.last_name), ''), '');
  NEW.phone := NULLIF(trim(COALESCE(NEW.phone, '')), '');
  NEW.birth_place := NULLIF(trim(COALESCE(NEW.birth_place, '')), '');
  NEW.province_of_birth := upper(NULLIF(trim(COALESCE(NEW.province_of_birth, '')), ''));
  NEW.residential_address := NULLIF(trim(COALESCE(NEW.residential_address, '')), '');
  NEW.city_of_residence := NULLIF(trim(COALESCE(NEW.city_of_residence, '')), '');
  NEW.province_of_residence := upper(NULLIF(trim(COALESCE(NEW.province_of_residence, '')), ''));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_prepaid_membership_row ON public.prepaid_memberships;
CREATE TRIGGER trg_normalize_prepaid_membership_row
BEFORE INSERT OR UPDATE ON public.prepaid_memberships
FOR EACH ROW
EXECUTE FUNCTION public.normalize_prepaid_membership_row();

CREATE OR REPLACE FUNCTION public._apply_prepaid_membership_to_user(
  p_prepaid_id uuid,
  p_user_id uuid,
  p_manually_assigned_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prepaid public.prepaid_memberships%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT *
  INTO v_prepaid
  FROM public.prepaid_memberships
  WHERE id = p_prepaid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prepaid membership not found';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_prepaid.status = 'activated'
     AND v_prepaid.matched_user_id IS NOT NULL
     AND v_prepaid.matched_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Prepaid membership is already activated for another user';
  END IF;

  UPDATE public.profiles
  SET
    first_name = COALESCE(NULLIF(v_prepaid.first_name, ''), public.profiles.first_name),
    last_name = COALESCE(NULLIF(v_prepaid.last_name, ''), public.profiles.last_name),
    phone = COALESCE(NULLIF(v_prepaid.phone, ''), public.profiles.phone),
    birth_date = COALESCE(v_prepaid.birth_date, public.profiles.birth_date),
    birth_place = COALESCE(NULLIF(v_prepaid.birth_place, ''), public.profiles.birth_place),
    province_of_birth = COALESCE(NULLIF(v_prepaid.province_of_birth, ''), public.profiles.province_of_birth),
    residential_address = COALESCE(NULLIF(v_prepaid.residential_address, ''), public.profiles.residential_address),
    city_of_residence = COALESCE(NULLIF(v_prepaid.city_of_residence, ''), public.profiles.city_of_residence),
    province_of_residence = COALESCE(NULLIF(v_prepaid.province_of_residence, ''), public.profiles.province_of_residence),
    updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.activate_membership(p_user_id);

  UPDATE public.profiles
  SET
    membership_year = v_prepaid.membership_year,
    membership_registration_date = COALESCE(v_prepaid.payment_date::timestamp with time zone, public.profiles.membership_registration_date),
    updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.prepaid_memberships
  SET
    status = 'activated',
    matched_user_id = p_user_id,
    activated_at = COALESCE(activated_at, now()),
    manually_assigned_at = CASE
      WHEN p_manually_assigned_by IS NULL THEN manually_assigned_at
      ELSE COALESCE(manually_assigned_at, now())
    END,
    imported_by = COALESCE(imported_by, p_manually_assigned_by),
    error_message = NULL,
    review_note = CASE
      WHEN p_manually_assigned_by IS NULL THEN review_note
      ELSE COALESCE(review_note, 'Associazione manuale da dashboard admin')
    END,
    updated_at = now()
  WHERE id = p_prepaid_id;

  RETURN jsonb_build_object(
    'applied', true,
    'prepaid_id', p_prepaid_id,
    'user_id', p_user_id,
    'membership_year', v_prepaid.membership_year
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_prepaid_membership_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_prepaid_id uuid;
BEGIN
  SELECT public._scamp_normalize_email(email)
  INTO v_email
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'missing_email');
  END IF;

  SELECT id
  INTO v_prepaid_id
  FROM public.prepaid_memberships
  WHERE email = v_email
    AND status = 'pending_user'
  ORDER BY membership_year DESC, created_at ASC
  LIMIT 1;

  IF v_prepaid_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_pending_prepaid_membership');
  END IF;

  RETURN public._apply_prepaid_membership_to_user(v_prepaid_id, p_user_id, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_prepaid_membership_after_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.reconcile_prepaid_membership_for_user(NEW.id);
  ELSIF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    PERFORM public.reconcile_prepaid_membership_for_user(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_prepaid_membership_after_profile_change ON public.profiles;
CREATE TRIGGER trg_apply_prepaid_membership_after_profile_change
AFTER INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.apply_prepaid_membership_after_profile_change();

CREATE OR REPLACE FUNCTION public.admin_activate_prepaid_membership(
  p_prepaid_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can activate prepaid memberships';
  END IF;

  RETURN public._apply_prepaid_membership_to_user(p_prepaid_id, p_user_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_import_prepaid_memberships(
  p_rows jsonb,
  p_batch_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row jsonb;
  v_batch_id uuid := gen_random_uuid();
  v_total integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_activated integer := 0;
  v_pending integer := 0;
  v_needs_review integer := 0;
  v_invalid integer := 0;
  v_already_activated integer := 0;
  v_errors integer := 0;
  v_email text;
  v_birth_date date;
  v_payment_date date;
  v_membership_year integer;
  v_prepaid_id uuid;
  v_prepaid_status text;
  v_profile_ids uuid[];
  v_profile_count integer;
  v_was_existing boolean;
  v_missing_fields text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can import prepaid memberships';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows payload must be a JSON array';
  END IF;

  v_total := jsonb_array_length(p_rows);

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_email := public._scamp_normalize_email(v_row ->> 'email');
      v_birth_date := public._scamp_safe_date(v_row ->> 'birth_date');
      v_payment_date := public._scamp_safe_date(v_row ->> 'payment_date');
      v_membership_year := CASE
        WHEN COALESCE(v_row ->> 'membership_year', '') ~ '^[0-9]{4}$'
          THEN (v_row ->> 'membership_year')::integer
        WHEN v_payment_date IS NOT NULL
          THEN extract(year FROM v_payment_date)::integer
        ELSE extract(year FROM now())::integer
      END;

      IF v_email IS NULL THEN
        v_invalid := v_invalid + 1;
        CONTINUE;
      END IF;

      v_missing_fields := ARRAY[]::text[];
      IF v_birth_date IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'birth_date');
      END IF;
      IF NULLIF(trim(COALESCE(v_row ->> 'birth_place', '')), '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'birth_place');
      END IF;
      IF NULLIF(trim(COALESCE(v_row ->> 'province_of_birth', '')), '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'province_of_birth');
      END IF;
      IF NULLIF(trim(COALESCE(v_row ->> 'residential_address', '')), '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'residential_address');
      END IF;
      IF NULLIF(trim(COALESCE(v_row ->> 'city_of_residence', '')), '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'city_of_residence');
      END IF;
      IF NULLIF(trim(COALESCE(v_row ->> 'province_of_residence', '')), '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'province_of_residence');
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.prepaid_memberships
        WHERE email = v_email
          AND membership_year = v_membership_year
      )
      INTO v_was_existing;

      INSERT INTO public.prepaid_memberships (
        email,
        first_name,
        last_name,
        phone,
        birth_date,
        birth_place,
        province_of_birth,
        residential_address,
        city_of_residence,
        province_of_residence,
        payment_date,
        membership_year,
        status,
        import_batch_id,
        import_batch_label,
        imported_by,
        error_message,
        source_row
      )
      VALUES (
        v_email,
        COALESCE(v_row ->> 'first_name', ''),
        COALESCE(v_row ->> 'last_name', ''),
        NULLIF(v_row ->> 'phone', ''),
        v_birth_date,
        NULLIF(v_row ->> 'birth_place', ''),
        NULLIF(v_row ->> 'province_of_birth', ''),
        NULLIF(v_row ->> 'residential_address', ''),
        NULLIF(v_row ->> 'city_of_residence', ''),
        NULLIF(v_row ->> 'province_of_residence', ''),
        v_payment_date,
        v_membership_year,
        CASE WHEN cardinality(v_missing_fields) > 0 THEN 'needs_review' ELSE 'pending_user' END,
        v_batch_id,
        NULLIF(trim(COALESCE(p_batch_label, '')), ''),
        auth.uid(),
        CASE
          WHEN cardinality(v_missing_fields) > 0 THEN 'Dati tesseramento incompleti: ' || array_to_string(v_missing_fields, ', ')
          ELSE NULL
        END,
        v_row
      )
      ON CONFLICT (email, membership_year) DO UPDATE
      SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        birth_date = EXCLUDED.birth_date,
        birth_place = EXCLUDED.birth_place,
        province_of_birth = EXCLUDED.province_of_birth,
        residential_address = EXCLUDED.residential_address,
        city_of_residence = EXCLUDED.city_of_residence,
        province_of_residence = EXCLUDED.province_of_residence,
        payment_date = EXCLUDED.payment_date,
        import_batch_id = EXCLUDED.import_batch_id,
        import_batch_label = EXCLUDED.import_batch_label,
        imported_by = EXCLUDED.imported_by,
        source_row = EXCLUDED.source_row,
        status = CASE
          WHEN public.prepaid_memberships.status = 'activated' THEN public.prepaid_memberships.status
          WHEN cardinality(v_missing_fields) > 0 THEN 'needs_review'
          ELSE 'pending_user'
        END,
        error_message = CASE
          WHEN public.prepaid_memberships.status = 'activated' THEN public.prepaid_memberships.error_message
          WHEN cardinality(v_missing_fields) > 0 THEN 'Dati tesseramento incompleti: ' || array_to_string(v_missing_fields, ', ')
          ELSE NULL
        END,
        updated_at = now()
      RETURNING id, status
      INTO v_prepaid_id, v_prepaid_status;

      IF v_was_existing THEN
        v_updated := v_updated + 1;
      ELSE
        v_inserted := v_inserted + 1;
      END IF;

      IF v_prepaid_status = 'activated' THEN
        v_already_activated := v_already_activated + 1;
        CONTINUE;
      END IF;

      IF cardinality(v_missing_fields) > 0 THEN
        v_needs_review := v_needs_review + 1;
        CONTINUE;
      END IF;

      SELECT array_agg(id ORDER BY created_at ASC), count(*)
      INTO v_profile_ids, v_profile_count
      FROM public.profiles
      WHERE public._scamp_normalize_email(email) = v_email;

      IF v_profile_count = 1 THEN
        PERFORM public._apply_prepaid_membership_to_user(v_prepaid_id, v_profile_ids[1], NULL);
        v_activated := v_activated + 1;
      ELSIF v_profile_count > 1 THEN
        UPDATE public.prepaid_memberships
        SET
          status = 'needs_review',
          error_message = 'Piu profili utente corrispondono a questa email',
          updated_at = now()
        WHERE id = v_prepaid_id;
        v_needs_review := v_needs_review + 1;
      ELSE
        v_pending := v_pending + 1;
      END IF;
    EXCEPTION WHEN others THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'total', v_total,
    'inserted', v_inserted,
    'updated', v_updated,
    'activated', v_activated,
    'pending', v_pending,
    'needs_review', v_needs_review,
    'invalid', v_invalid,
    'already_activated', v_already_activated,
    'errors', v_errors
  );
END;
$$;

ALTER TABLE public.prepaid_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view prepaid memberships" ON public.prepaid_memberships;
CREATE POLICY "Admins can view prepaid memberships"
ON public.prepaid_memberships
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert prepaid memberships" ON public.prepaid_memberships;
CREATE POLICY "Admins can insert prepaid memberships"
ON public.prepaid_memberships
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update prepaid memberships" ON public.prepaid_memberships;
CREATE POLICY "Admins can update prepaid memberships"
ON public.prepaid_memberships
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete prepaid memberships" ON public.prepaid_memberships;
CREATE POLICY "Admins can delete prepaid memberships"
ON public.prepaid_memberships
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prepaid_memberships TO authenticated;
GRANT ALL ON TABLE public.prepaid_memberships TO service_role;

REVOKE ALL ON FUNCTION public._apply_prepaid_membership_to_user(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_prepaid_membership_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_prepaid_membership_after_profile_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_import_prepaid_memberships(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_activate_prepaid_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_import_prepaid_memberships(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_prepaid_membership(uuid, uuid) TO authenticated;
