
-- Discount codes table
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text NOT NULL DEFAULT '',
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  event_ids uuid[] DEFAULT NULL,
  applies_to_all boolean NOT NULL DEFAULT false,
  max_uses integer DEFAULT NULL,
  times_used integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_code UNIQUE (code)
);

-- Usage tracking table
CREATE TABLE public.discount_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  original_price numeric NOT NULL,
  discounted_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Discount codes policies
CREATE POLICY "Admins can manage all discount codes" ON public.discount_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizers can manage own discount codes" ON public.discount_codes
  FOR ALL TO authenticated
  USING (created_by = auth.uid() AND NOT applies_to_all)
  WITH CHECK (created_by = auth.uid() AND NOT applies_to_all);

CREATE POLICY "Anyone can read active discount codes" ON public.discount_codes
  FOR SELECT TO public
  USING (is_active = true);

-- Usage policies
CREATE POLICY "Admins can view all usage" ON public.discount_code_usage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own usage" ON public.discount_code_usage
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own usage" ON public.discount_code_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Function to validate and apply discount code
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code text,
  p_event_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_discount record;
  v_already_used boolean;
  v_event_price numeric;
  v_final_price numeric;
BEGIN
  -- Find the code
  SELECT * INTO v_discount FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto non valido');
  END IF;

  -- Check expiration
  IF v_discount.expires_at IS NOT NULL AND v_discount.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto scaduto');
  END IF;

  -- Check max uses
  IF v_discount.max_uses IS NOT NULL AND v_discount.times_used >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto esaurito');
  END IF;

  -- Check if applies to this event
  IF NOT v_discount.applies_to_all AND v_discount.event_ids IS NOT NULL AND NOT (p_event_id = ANY(v_discount.event_ids)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice non valido per questo evento');
  END IF;

  -- Check if user already used this code for this event
  SELECT EXISTS(
    SELECT 1 FROM discount_code_usage
    WHERE discount_code_id = v_discount.id AND user_id = p_user_id AND event_id = p_event_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Hai già utilizzato questo codice per questo evento');
  END IF;

  -- Get event price
  SELECT CASE
    WHEN payment_type = 'deposit' AND deposit IS NOT NULL THEN deposit
    WHEN payment_type = 'paid' THEN price
    ELSE 0
  END INTO v_event_price
  FROM events WHERE id = p_event_id;

  -- Calculate discounted price
  IF v_discount.discount_type = 'percentage' THEN
    v_final_price := GREATEST(0, v_event_price - (v_event_price * v_discount.discount_value / 100));
  ELSE
    v_final_price := GREATEST(0, v_event_price - v_discount.discount_value);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_code_id', v_discount.id,
    'discount_type', v_discount.discount_type,
    'discount_value', v_discount.discount_value,
    'original_price', v_event_price,
    'final_price', ROUND(v_final_price, 2),
    'description', v_discount.description
  );
END;
$$;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION public.increment_discount_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE discount_codes SET times_used = times_used + 1, updated_at = now()
  WHERE id = NEW.discount_code_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_discount_usage_insert
  AFTER INSERT ON public.discount_code_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_discount_usage();
