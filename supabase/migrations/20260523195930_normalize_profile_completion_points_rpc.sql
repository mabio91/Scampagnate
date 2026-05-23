-- Keep legacy clients safe while production rolls forward: older bundles may
-- still call add_user_points with the historical profile_complete type.

DO $$
DECLARE
  legacy_row record;
  affected_user_id uuid;
BEGIN
  FOR legacy_row IN
    SELECT
      user_id,
      COALESCE(reference_id, user_id) AS reference_id,
      max(value) AS value,
      COALESCE(max(NULLIF(description, '')), 'Profilo completato al 100%') AS description,
      (array_agg(admin_id) FILTER (WHERE admin_id IS NOT NULL))[1] AS admin_id
    FROM public.points_history
    WHERE type = 'profile_complete'
    GROUP BY user_id, COALESCE(reference_id, user_id)
  LOOP
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (
      legacy_row.user_id,
      'profile_completed',
      legacy_row.value,
      legacy_row.reference_id,
      legacy_row.description,
      legacy_row.admin_id
    )
    ON CONFLICT (user_id, type, reference_id)
      WHERE reference_id IS NOT NULL
    DO UPDATE SET
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      admin_id = COALESCE(EXCLUDED.admin_id, public.points_history.admin_id);
  END LOOP;

  FOR affected_user_id IN
    SELECT DISTINCT user_id
    FROM public.points_history
    WHERE type = 'profile_complete'
  LOOP
    DELETE FROM public.points_history
    WHERE user_id = affected_user_id
      AND type = 'profile_complete';

    PERFORM public.recalculate_user_total_points(affected_user_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_user_points(
  p_user_id uuid,
  p_type text,
  p_value integer,
  p_reference_id uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_admin_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text := COALESCE(auth.role(), '');
  v_type text := CASE
    WHEN p_type = 'profile_complete' THEN 'profile_completed'
    ELSE p_type
  END;
  v_reference_id uuid := p_reference_id;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id'
      USING ERRCODE = '22023';
  END IF;

  IF v_type = 'profile_completed' THEN
    v_reference_id := COALESCE(v_reference_id, p_user_id);
  END IF;

  IF v_actor_role <> 'service_role' THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = '42501';
    END IF;

    IF v_actor_id <> p_user_id
      AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can award points to other users'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_reference_id IS NOT NULL THEN
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, v_type, p_value, v_reference_id, p_description, p_admin_id)
    ON CONFLICT (user_id, type, reference_id)
      WHERE reference_id IS NOT NULL
    DO UPDATE SET
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      admin_id = COALESCE(EXCLUDED.admin_id, public.points_history.admin_id)
    WHERE public.points_history.value IS DISTINCT FROM EXCLUDED.value
       OR public.points_history.description IS DISTINCT FROM EXCLUDED.description
       OR (EXCLUDED.admin_id IS NOT NULL AND public.points_history.admin_id IS DISTINCT FROM EXCLUDED.admin_id);
  ELSE
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, v_type, p_value, NULL, p_description, p_admin_id);
  END IF;

  PERFORM public.recalculate_user_total_points(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) TO service_role;
