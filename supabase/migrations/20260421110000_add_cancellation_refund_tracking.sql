ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS service_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_percentage integer,
  ADD COLUMN IF NOT EXISTS refund_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS refund_status text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

UPDATE public.events
SET cancellation_policy = CASE lower(coalesce(cancellation_policy, ''))
  WHEN 'flexible' THEN 'flexible_24h'
  WHEN 'flessibile' THEN 'flexible_24h'
  WHEN 'moderate' THEN 'flexible_48h'
  WHEN 'moderata' THEN 'flexible_48h'
  WHEN 'strict' THEN 'non_refundable'
  WHEN 'rigida' THEN 'non_refundable'
  ELSE cancellation_policy
END
WHERE cancellation_policy IS NOT NULL;

UPDATE public.event_registrations er
SET
  cancellation_policy = e.cancellation_policy,
  service_fee_amount = CASE
    WHEN e.payment_type IN ('paid', 'deposit') THEN 1
    ELSE 0
  END,
  amount_paid = CASE
    WHEN e.payment_type = 'deposit' THEN coalesce(e.deposit, 0) + CASE WHEN e.payment_type IN ('paid', 'deposit') THEN 1 ELSE 0 END
    WHEN e.payment_type = 'paid' THEN coalesce((SELECT price FROM public.event_price_options WHERE id = er.price_option_id), e.price, 0) + CASE WHEN e.payment_type IN ('paid', 'deposit') THEN 1 ELSE 0 END
    ELSE coalesce(er.amount_paid, 0)
  END,
  refund_status = CASE
    WHEN er.payment_status = 'refunded' THEN 'completed'
    WHEN er.payment_status = 'refund_failed' THEN 'failed'
    WHEN er.payment_status = 'paid' THEN 'not_requested'
    ELSE coalesce(er.refund_status, 'not_applicable')
  END,
  cancelled_at = CASE
    WHEN er.status = 'cancelled' THEN coalesce(er.cancelled_at, er.created_at)
    ELSE er.cancelled_at
  END
FROM public.events e
WHERE er.event_id = e.id;
