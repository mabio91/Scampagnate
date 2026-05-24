REVOKE ALL ON TABLE public.event_staff FROM anon;
REVOKE ALL ON TABLE public.event_staff FROM authenticated;

GRANT SELECT ON TABLE public.event_staff TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_staff TO authenticated;
GRANT ALL ON TABLE public.event_staff TO service_role;
