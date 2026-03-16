
-- Create event_price_options table
CREATE TABLE public.event_price_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_price_options ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view price options" ON public.event_price_options
  FOR SELECT TO public USING (true);

CREATE POLICY "Organizers can manage own event price options" ON public.event_price_options
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_price_options.event_id AND events.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = event_price_options.event_id AND events.organizer_id = auth.uid()));

CREATE POLICY "Admins can manage all price options" ON public.event_price_options
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add price_option_id to event_registrations
ALTER TABLE public.event_registrations
  ADD COLUMN price_option_id uuid REFERENCES public.event_price_options(id) ON DELETE SET NULL;
