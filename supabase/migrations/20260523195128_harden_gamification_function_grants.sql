-- Keep the public add-points RPC available only to signed-in users, and only
-- for self-awards unless the caller is an admin.

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
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id'
      USING ERRCODE = '22023';
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

  IF p_reference_id IS NOT NULL THEN
    INSERT INTO public.points_history (user_id, type, value, reference_id, description, admin_id)
    VALUES (p_user_id, p_type, p_value, p_reference_id, p_description, p_admin_id)
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
    VALUES (p_user_id, p_type, p_value, NULL, p_description, p_admin_id);
  END IF;

  PERFORM public.recalculate_user_total_points(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_points(uuid, text, integer, uuid, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.award_badges_on_checkin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_badges_on_checkin() FROM anon;
REVOKE ALL ON FUNCTION public.award_badges_on_checkin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_badges_on_checkin() TO service_role;

REVOKE ALL ON FUNCTION public.award_event_attendance_badges(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_event_attendance_badges(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.award_event_attendance_badges(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_event_attendance_badges(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.award_mission_rewards(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_mission_rewards(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.award_mission_rewards(uuid, uuid, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_mission_rewards(uuid, uuid, boolean) TO service_role;
