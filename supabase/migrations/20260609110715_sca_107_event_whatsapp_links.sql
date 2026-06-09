CREATE TABLE IF NOT EXISTS public.event_whatsapp_links (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT event_whatsapp_links_url_not_blank CHECK (btrim(url) <> ''),
  CONSTRAINT event_whatsapp_links_url_is_whatsapp_group_invite
    CHECK (lower(btrim(url)) ~ '^https://chat\.whatsapp\.com/[^[:space:]]+$')
);

COMMENT ON TABLE public.event_whatsapp_links IS
  'Protected WhatsApp group invite link for an event. Visible only to admins, the event organizer, and active participants.';

COMMENT ON COLUMN public.event_whatsapp_links.url IS
  'WhatsApp group invite URL, expected in the https://chat.whatsapp.com/... format.';

CREATE INDEX IF NOT EXISTS event_whatsapp_links_created_by_idx
  ON public.event_whatsapp_links(created_by)
  WHERE created_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_event_whatsapp_links_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_event_whatsapp_links_updated_at
  ON public.event_whatsapp_links;

CREATE TRIGGER set_event_whatsapp_links_updated_at
  BEFORE UPDATE ON public.event_whatsapp_links
  FOR EACH ROW
  EXECUTE FUNCTION public.set_event_whatsapp_links_updated_at();

ALTER TABLE public.event_whatsapp_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants and owners can view event whatsapp links"
  ON public.event_whatsapp_links;

CREATE POLICY "Participants and owners can view event whatsapp links"
  ON public.event_whatsapp_links
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_whatsapp_links.event_id
        AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_registrations er
      WHERE er.event_id = event_whatsapp_links.event_id
        AND er.user_id = auth.uid()
        AND public.is_active_event_participant_status(er.status::text, er.payment_status)
    )
  );

DROP POLICY IF EXISTS "Event owners and admins can insert event whatsapp links"
  ON public.event_whatsapp_links;

CREATE POLICY "Event owners and admins can insert event whatsapp links"
  ON public.event_whatsapp_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_whatsapp_links.event_id
        AND e.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Event owners and admins can update event whatsapp links"
  ON public.event_whatsapp_links;

CREATE POLICY "Event owners and admins can update event whatsapp links"
  ON public.event_whatsapp_links
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_whatsapp_links.event_id
        AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_whatsapp_links.event_id
        AND e.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Event owners and admins can delete event whatsapp links"
  ON public.event_whatsapp_links;

CREATE POLICY "Event owners and admins can delete event whatsapp links"
  ON public.event_whatsapp_links
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_whatsapp_links.event_id
        AND e.organizer_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.event_whatsapp_links FROM anon;
GRANT SELECT ON TABLE public.event_whatsapp_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_whatsapp_links TO authenticated;
GRANT ALL ON TABLE public.event_whatsapp_links TO service_role;

REVOKE ALL ON FUNCTION public.set_event_whatsapp_links_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_whatsapp_links_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_event_whatsapp_links_updated_at() TO service_role;

SELECT public.scamp_install_admin_organizer_activity_triggers();
