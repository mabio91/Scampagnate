-- Surface manual admin point awards as user-facing rewards and notifications.

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
  v_points_history_id uuid;
  v_points_unit text;
  v_points_label text;
  v_reason text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id'
      USING ERRCODE = '22023';
  END IF;

  IF p_value IS NULL THEN
    RAISE EXCEPTION 'Missing points value'
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

    IF v_type = 'admin_manual'
      AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only admins can manually award points'
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
       OR (EXCLUDED.admin_id IS NOT NULL AND public.points_history.admin_id IS DISTINCT FROM EXCLUDED.admin_id)
    RETURNING id INTO v_points_history_id;
  ELSE
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, v_type, p_value, NULL, p_description, p_admin_id)
    RETURNING id INTO v_points_history_id;
  END IF;

  PERFORM public.recalculate_user_total_points(p_user_id);

  IF v_type = 'admin_manual'
    AND p_value > 0
    AND v_points_history_id IS NOT NULL THEN
    v_points_unit := CASE WHEN p_value = 1 THEN 'punto' ELSE 'punti' END;
    v_points_label := '+' || p_value::text || ' ' || v_points_unit;
    v_reason := NULLIF(BTRIM(COALESCE(p_description, '')), '');

    INSERT INTO public.user_rewards (user_id, type, title, value, status)
    VALUES (
      p_user_id,
      'points',
      COALESCE(v_reason, 'Punti aggiunti dal team'),
      v_points_label,
      'active'
    );

    INSERT INTO public.notifications (user_id, type, title, message, event_id)
    VALUES (
      p_user_id,
      'points',
      'Hai guadagnato ' || p_value::text || ' ' || v_points_unit,
      COALESCE(v_reason, 'Il team Scampagnate ti ha assegnato ' || p_value::text || ' ' || v_points_unit || '.'),
      NULL
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) TO service_role;
