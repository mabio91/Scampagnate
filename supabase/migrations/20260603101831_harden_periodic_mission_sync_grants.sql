REVOKE ALL ON FUNCTION public.sync_user_missions_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_user_missions_for_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sync_user_missions_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_missions_for_user(uuid) TO service_role;
