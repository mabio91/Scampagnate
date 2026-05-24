CREATE TABLE public.event_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role_label text NOT NULL DEFAULT 'Staff',
  avatar_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_staff_display_name_not_blank CHECK (btrim(display_name) <> ''),
  CONSTRAINT event_staff_role_label_not_blank CHECK (btrim(role_label) <> '')
);

CREATE INDEX event_staff_event_id_sort_order_idx
  ON public.event_staff(event_id, sort_order, created_at);

CREATE INDEX event_staff_profile_id_idx
  ON public.event_staff(profile_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public event staff"
  ON public.event_staff
  FOR SELECT
  USING (
    is_public
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_staff.event_id
        AND e.visibility = 'public'::public.event_visibility
    )
  );

CREATE POLICY "Event owners and admins can view event staff"
  ON public.event_staff
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_staff.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Event owners and admins can insert event staff"
  ON public.event_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_staff.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Event owners and admins can update event staff"
  ON public.event_staff
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_staff.event_id
        AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_staff.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Event owners and admins can delete event staff"
  ON public.event_staff
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_staff.event_id
        AND e.organizer_id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.event_staff TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_staff TO authenticated;
GRANT ALL ON TABLE public.event_staff TO service_role;
