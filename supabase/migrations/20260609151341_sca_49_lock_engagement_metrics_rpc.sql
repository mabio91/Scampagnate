REVOKE ALL ON FUNCTION public.get_event_engagement_metrics(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_engagement_metrics(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_event_engagement_metrics(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.send_push_on_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_push_on_notification() FROM anon;
REVOKE ALL ON FUNCTION public.send_push_on_notification() FROM authenticated;

NOTIFY pgrst, 'reload schema';
