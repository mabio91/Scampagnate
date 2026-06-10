REVOKE ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_attended_events_in_category(uuid, text, jsonb) TO service_role;
