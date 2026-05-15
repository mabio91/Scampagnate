ALTER VIEW public.admin_user_activity_timeline
SET (security_invoker = true);

REVOKE ALL ON TABLE public.admin_user_activity_timeline
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.admin_user_activity_timeline TO authenticated;
GRANT SELECT ON TABLE public.admin_user_activity_timeline TO service_role;
