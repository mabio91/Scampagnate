ALTER TABLE public.activity_proposals
  ADD COLUMN location_label text DEFAULT NULL,
  ADD COLUMN category_id uuid DEFAULT NULL REFERENCES public.event_categories(id);