REVOKE ALL ON FUNCTION public._scamp_user_audit_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._scamp_user_audit_trigger() FROM anon;
REVOKE ALL ON FUNCTION public._scamp_user_audit_trigger() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._scamp_user_audit_trigger() TO service_role;

REVOKE ALL ON FUNCTION public.scamp_user_activity_log_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.scamp_user_activity_log_trigger() FROM anon;
REVOKE ALL ON FUNCTION public.scamp_user_activity_log_trigger() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.scamp_user_activity_log_trigger() TO service_role;
