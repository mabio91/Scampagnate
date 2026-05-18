-- Supabase grants EXECUTE on new routines to API roles explicitly in this
-- project. The prepaid import helpers are implementation details and should
-- not be callable from anon/authenticated clients.
REVOKE ALL ON FUNCTION public._scamp_normalize_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._scamp_safe_date(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_prepaid_membership_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._apply_prepaid_membership_to_user(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_prepaid_membership_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_prepaid_membership_after_profile_change() FROM PUBLIC, anon, authenticated;

-- Keep only the dashboard RPC entry points callable by signed-in users. Both
-- functions still enforce public.has_role(auth.uid(), 'admin') internally.
REVOKE ALL ON FUNCTION public.admin_import_prepaid_memberships(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_activate_prepaid_membership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_import_prepaid_memberships(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_prepaid_membership(uuid, uuid) TO authenticated;
