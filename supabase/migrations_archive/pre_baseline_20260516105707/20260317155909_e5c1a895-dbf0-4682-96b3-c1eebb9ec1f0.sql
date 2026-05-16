
CREATE OR REPLACE FUNCTION public.validate_discount_code(p_code text, p_event_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Check not yet started
  IF v_discount.starts_at IS NOT NULL AND v_discount.starts_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto non ancora attivo');
  END IF;

  -- Check expiration
  IF v_discount.expires_at IS NOT NULL AND v_discount.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto scaduto');
  END IF;

  -- Check max uses
  IF v_discount.max_uses IS NOT NULL AND v_discount.times_used >= v_discount.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto esaurito');
  END IF;

  -- Check user-specific assignment
  IF v_discount.assigned_user_id IS NOT NULL AND v_discount.assigned_user_id != p_user_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice sconto non valido per il tuo account');
  END IF;

  -- Check single-use: if is_single_use, check if this user has used it for ANY event
  IF v_discount.is_single_use THEN
    IF EXISTS (
      SELECT 1 FROM discount_code_usage
      WHERE discount_code_id = v_discount.id AND user_id = p_user_id
    ) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Hai già utilizzato questo codice');
    END IF;
  END IF;

  -- Check if applies to this event
  IF NOT v_discount.applies_to_all AND v_discount.event_ids IS NOT NULL AND NOT (p_event_id = ANY(v_discount.event_ids)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Codice non valido per questo evento');
  END IF;

  -- Check if user already used this code for this event (non single-use case)
  IF NOT v_discount.is_single_use THEN
    SELECT EXISTS(
      SELECT 1 FROM discount_code_usage
      WHERE discount_code_id = v_discount.id AND user_id = p_user_id AND event_id = p_event_id
    ) INTO v_already_used;

    IF v_already_used THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Hai già utilizzato questo codice per questo evento');
    END IF;
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
$function$;
