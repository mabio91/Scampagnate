
-- Activity proposals table
CREATE TABLE public.activity_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_name text NOT NULL DEFAULT '',
  proposer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_title text NOT NULL,
  location text NOT NULL DEFAULT '',
  suggested_date text,
  suggested_time text,
  description text NOT NULL DEFAULT '',
  max_participants integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_proposals ENABLE ROW LEVEL SECURITY;

-- Only admins and organizers can view all proposals
CREATE POLICY "Admins can manage proposals" ON public.activity_proposals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organizers can view proposals" ON public.activity_proposals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'organizer'::app_role));

-- Users can only see their own proposals
CREATE POLICY "Users can view own proposals" ON public.activity_proposals
  FOR SELECT TO authenticated
  USING (proposer_id = auth.uid());

-- Anyone (authenticated or not) can submit proposals
CREATE POLICY "Anyone can submit proposals" ON public.activity_proposals
  FOR INSERT TO public
  WITH CHECK (true);
