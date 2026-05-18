ALTER TABLE public.prepaid_memberships
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.prepaid_memberships
  ADD COLUMN IF NOT EXISTS identity_match_key text;

CREATE OR REPLACE FUNCTION public._scamp_identity_part(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              trim(COALESCE(value, '')),
              'àáâãäåèéêëìíîïòóôõöùúûüçñ’',
              'aaaaaaeeeeiiiiooooouuuucn'''
            )
          ),
          '[^a-z0-9]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public._scamp_prepaid_identity_key(
  p_first_name text,
  p_last_name text,
  p_birth_date date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public._scamp_identity_part(p_first_name) IS NULL
      OR public._scamp_identity_part(p_last_name) IS NULL
      OR p_birth_date IS NULL
      THEN NULL
    ELSE concat_ws(
      '|',
      public._scamp_identity_part(p_first_name),
      public._scamp_identity_part(p_last_name),
      p_birth_date::text
    )
  END
$$;

UPDATE public.prepaid_memberships
SET identity_match_key = public._scamp_prepaid_identity_key(first_name, last_name, birth_date)
WHERE identity_match_key IS DISTINCT FROM public._scamp_prepaid_identity_key(first_name, last_name, birth_date);

CREATE UNIQUE INDEX IF NOT EXISTS prepaid_memberships_identity_year_key
  ON public.prepaid_memberships (identity_match_key, membership_year)
  WHERE identity_match_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS prepaid_memberships_identity_match_key_idx
  ON public.prepaid_memberships (identity_match_key)
  WHERE identity_match_key IS NOT NULL;

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
  NEW.identity_match_key := public._scamp_prepaid_identity_key(NEW.first_name, NEW.last_name, NEW.birth_date);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

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
  v_already_active boolean;
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

  v_already_active := lower(COALESCE(v_profile.membership_status, '')) = 'active'
    OR v_profile.membership_id IS NOT NULL;

  IF v_already_active THEN
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
      review_note = COALESCE(review_note, 'Utente gia con membership attiva: import registrato senza modifiche al profilo'),
      updated_at = now()
    WHERE id = p_prepaid_id;

    RETURN jsonb_build_object(
      'applied', false,
      'already_active', true,
      'prepaid_id', p_prepaid_id,
      'user_id', p_user_id,
      'membership_year', v_prepaid.membership_year
    );
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
    'already_active', false,
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
  v_profile public.profiles%ROWTYPE;
  v_email text;
  v_identity_key text;
  v_prepaid_id uuid;
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'missing_profile');
  END IF;

  v_email := public._scamp_normalize_email(v_profile.email);
  v_identity_key := public._scamp_prepaid_identity_key(v_profile.first_name, v_profile.last_name, v_profile.birth_date);

  IF v_email IS NULL AND v_identity_key IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'missing_match_key');
  END IF;

  SELECT id
  INTO v_prepaid_id
  FROM public.prepaid_memberships
  WHERE status = 'pending_user'
    AND (
      (v_email IS NOT NULL AND email = v_email)
      OR (v_identity_key IS NOT NULL AND identity_match_key = v_identity_key)
    )
  ORDER BY
    CASE WHEN v_email IS NOT NULL AND email = v_email THEN 0 ELSE 1 END,
    membership_year DESC,
    created_at ASC
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
  IF TG_OP = 'INSERT' THEN
    PERFORM public.reconcile_prepaid_membership_for_user(NEW.id);
  ELSIF TG_OP = 'UPDATE'
    AND (
      OLD.email IS DISTINCT FROM NEW.email
      OR OLD.first_name IS DISTINCT FROM NEW.first_name
      OR OLD.last_name IS DISTINCT FROM NEW.last_name
      OR OLD.birth_date IS DISTINCT FROM NEW.birth_date
      OR OLD.birth_place IS DISTINCT FROM NEW.birth_place
    ) THEN
    PERFORM public.reconcile_prepaid_membership_for_user(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_prepaid_membership_after_profile_change ON public.profiles;
CREATE TRIGGER trg_apply_prepaid_membership_after_profile_change
AFTER INSERT OR UPDATE OF email, first_name, last_name, birth_date, birth_place ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.apply_prepaid_membership_after_profile_change();

CREATE OR REPLACE FUNCTION public.admin_apply_prepaid_membership_to_user(
  p_prepaid_id uuid,
  p_user_id uuid,
  p_manually_assigned_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_prepaid public.prepaid_memberships%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_already_active boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only admins can apply prepaid memberships';
  END IF;

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

  v_already_active := lower(COALESCE(v_profile.membership_status, '')) = 'active'
    OR v_profile.membership_id IS NOT NULL;

  IF v_already_active THEN
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
      review_note = COALESCE(review_note, 'Utente gia con membership attiva: import registrato senza modifiche al profilo'),
      updated_at = now()
    WHERE id = p_prepaid_id;

    RETURN jsonb_build_object(
      'applied', false,
      'already_active', true,
      'prepaid_id', p_prepaid_id,
      'user_id', p_user_id,
      'membership_year', v_prepaid.membership_year
    );
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
    'already_active', false,
    'prepaid_id', p_prepaid_id,
    'user_id', p_user_id,
    'membership_year', v_prepaid.membership_year
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_import_prepaid_memberships(
  p_rows jsonb,
  p_batch_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
  v_first_name text;
  v_last_name text;
  v_birth_date date;
  v_payment_date date;
  v_membership_year integer;
  v_identity_key text;
  v_prepaid_id uuid;
  v_prepaid_status text;
  v_profile_ids uuid[];
  v_profile_count integer;
  v_was_existing boolean;
  v_missing_fields text[];
  v_apply_result jsonb;
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
      v_first_name := COALESCE(NULLIF(trim(COALESCE(v_row ->> 'first_name', '')), ''), '');
      v_last_name := COALESCE(NULLIF(trim(COALESCE(v_row ->> 'last_name', '')), ''), '');
      v_birth_date := public._scamp_safe_date(v_row ->> 'birth_date');
      v_payment_date := public._scamp_safe_date(v_row ->> 'payment_date');
      v_identity_key := public._scamp_prepaid_identity_key(v_first_name, v_last_name, v_birth_date);
      v_membership_year := CASE
        WHEN COALESCE(v_row ->> 'membership_year', '') ~ '^[0-9]{4}$'
          THEN (v_row ->> 'membership_year')::integer
        WHEN v_payment_date IS NOT NULL
          THEN extract(year FROM v_payment_date)::integer
        ELSE extract(year FROM now())::integer
      END;

      IF v_email IS NULL AND v_identity_key IS NULL THEN
        v_invalid := v_invalid + 1;
        CONTINUE;
      END IF;

      v_missing_fields := ARRAY[]::text[];
      IF NULLIF(v_first_name, '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'first_name');
      END IF;
      IF NULLIF(v_last_name, '') IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'last_name');
      END IF;
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

      SELECT id, status
      INTO v_prepaid_id, v_prepaid_status
      FROM public.prepaid_memberships
      WHERE membership_year = v_membership_year
        AND (
          (v_email IS NOT NULL AND email = v_email)
          OR (v_identity_key IS NOT NULL AND identity_match_key = v_identity_key)
        )
      ORDER BY
        CASE WHEN v_email IS NOT NULL AND email = v_email THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT 1;

      v_was_existing := v_prepaid_id IS NOT NULL;

      IF v_was_existing THEN
        UPDATE public.prepaid_memberships
        SET
          email = COALESCE(v_email, public.prepaid_memberships.email),
          first_name = v_first_name,
          last_name = v_last_name,
          phone = NULLIF(v_row ->> 'phone', ''),
          birth_date = v_birth_date,
          birth_place = NULLIF(v_row ->> 'birth_place', ''),
          province_of_birth = NULLIF(v_row ->> 'province_of_birth', ''),
          residential_address = NULLIF(v_row ->> 'residential_address', ''),
          city_of_residence = NULLIF(v_row ->> 'city_of_residence', ''),
          province_of_residence = NULLIF(v_row ->> 'province_of_residence', ''),
          payment_date = v_payment_date,
          import_batch_id = v_batch_id,
          import_batch_label = NULLIF(trim(COALESCE(p_batch_label, '')), ''),
          imported_by = auth.uid(),
          source_row = v_row,
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
        WHERE id = v_prepaid_id
        RETURNING status
        INTO v_prepaid_status;

        v_updated := v_updated + 1;
      ELSE
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
          v_first_name,
          v_last_name,
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
        RETURNING id, status
        INTO v_prepaid_id, v_prepaid_status;

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
      WHERE (v_email IS NOT NULL AND public._scamp_normalize_email(email) = v_email)
        OR (v_identity_key IS NOT NULL AND public._scamp_prepaid_identity_key(first_name, last_name, birth_date) = v_identity_key);

      IF v_profile_count = 1 THEN
        SELECT public.admin_apply_prepaid_membership_to_user(v_prepaid_id, v_profile_ids[1], NULL)
        INTO v_apply_result;

        IF COALESCE((v_apply_result ->> 'already_active')::boolean, false) THEN
          v_already_activated := v_already_activated + 1;
        ELSE
          v_activated := v_activated + 1;
        END IF;
      ELSIF v_profile_count > 1 THEN
        UPDATE public.prepaid_memberships
        SET
          status = 'needs_review',
          error_message = 'Piu profili utente corrispondono a questa riga importata',
          updated_at = now()
        WHERE id = v_prepaid_id;
        v_needs_review := v_needs_review + 1;
      ELSE
        v_pending := v_pending + 1;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      v_errors := v_errors + 1;
    WHEN others THEN
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

REVOKE ALL ON FUNCTION public._scamp_identity_part(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._scamp_prepaid_identity_key(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._scamp_identity_part(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._scamp_prepaid_identity_key(text, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public._apply_prepaid_membership_to_user(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_prepaid_membership_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_prepaid_membership_after_profile_change() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_apply_prepaid_membership_to_user(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_import_prepaid_memberships(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_activate_prepaid_membership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_prepaid_membership_to_user(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_prepaid_memberships(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_prepaid_membership(uuid, uuid) TO authenticated;
