
CREATE TABLE public.merch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_it text,
  description text NOT NULL DEFAULT '',
  description_it text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  badge text,
  badge_it text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merch_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.merch_products
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can manage products" ON public.merch_products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
