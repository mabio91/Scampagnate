DROP POLICY IF EXISTS "Admins can view admin organizer activity log"
  ON public.admin_organizer_activity_log;

CREATE POLICY "Admins can view admin organizer activity log"
  ON public.admin_organizer_activity_log
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
