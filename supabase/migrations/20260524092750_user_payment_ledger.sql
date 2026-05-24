CREATE TABLE IF NOT EXISTS public.user_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.event_registrations(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('payment', 'refund')),
  source text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  event_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (event_amount >= 0),
  service_fee_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (service_fee_amount >= 0),
  membership_fee_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (membership_fee_amount >= 0),
  currency text NOT NULL DEFAULT 'eur',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_payment_transactions_checkout_kind_source_key
  ON public.user_payment_transactions(stripe_checkout_session_id, kind, source)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_payment_transactions_refund_key
  ON public.user_payment_transactions(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_payment_transactions_user_created_idx
  ON public.user_payment_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_payment_transactions_registration_idx
  ON public.user_payment_transactions(registration_id, created_at DESC)
  WHERE registration_id IS NOT NULL;

ALTER TABLE public.user_payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment ledger"
  ON public.user_payment_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage payment ledger"
  ON public.user_payment_transactions
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.user_payment_transactions (
  user_id,
  registration_id,
  event_id,
  kind,
  source,
  amount,
  event_amount,
  service_fee_amount,
  membership_fee_amount,
  currency,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  stripe_refund_id,
  metadata,
  created_at
)
SELECT
  rpt.user_id,
  rpt.registration_id,
  rpt.event_id,
  rpt.kind,
  rpt.source,
  rpt.amount,
  CASE
    WHEN rpt.kind = 'payment' THEN GREATEST(
      rpt.amount - CASE
        WHEN COALESCE(rpt.metadata ->> 'service_fee_cents', '') ~ '^[0-9]+$'
          THEN ((rpt.metadata ->> 'service_fee_cents')::numeric / 100)
        ELSE 0
      END,
      0
    )
    ELSE rpt.amount
  END,
  CASE
    WHEN rpt.kind = 'payment' AND COALESCE(rpt.metadata ->> 'service_fee_cents', '') ~ '^[0-9]+$'
      THEN ((rpt.metadata ->> 'service_fee_cents')::numeric / 100)
    ELSE 0
  END,
  0,
  rpt.currency,
  rpt.stripe_checkout_session_id,
  rpt.stripe_payment_intent_id,
  rpt.stripe_refund_id,
  jsonb_build_object('backfill_source', 'registration_payment_transactions') || rpt.metadata,
  rpt.created_at
FROM public.registration_payment_transactions rpt
WHERE rpt.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_payment_transactions (
  user_id,
  registration_id,
  event_id,
  kind,
  source,
  amount,
  event_amount,
  service_fee_amount,
  currency,
  stripe_payment_intent_id,
  metadata,
  created_at
)
SELECT
  er.user_id,
  er.id,
  er.event_id,
  'payment',
  'legacy_event_registration',
  er.amount_paid,
  GREATEST(er.amount_paid - COALESCE(er.service_fee_amount, 0), 0),
  COALESCE(er.service_fee_amount, 0),
  'eur',
  er.stripe_payment_intent_id,
  jsonb_build_object(
    'backfill_source', 'event_registrations',
    'payment_status', er.payment_status
  ),
  er.created_at
FROM public.event_registrations er
WHERE er.user_id IS NOT NULL
  AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
  AND er.stripe_payment_intent_id IS NOT NULL
  AND COALESCE(er.amount_paid, 0) > 0
  AND er.payment_status IN ('paid', 'deposit_paid', 'refunded', 'refund_failed')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_payment_transactions upt
    WHERE upt.registration_id = er.id
      AND upt.kind = 'payment'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.user_payment_transactions (
  user_id,
  registration_id,
  event_id,
  kind,
  source,
  amount,
  event_amount,
  currency,
  stripe_payment_intent_id,
  metadata,
  created_at
)
SELECT
  er.user_id,
  er.id,
  er.event_id,
  'refund',
  'legacy_event_refund',
  er.refund_amount,
  er.refund_amount,
  'eur',
  er.stripe_payment_intent_id,
  jsonb_build_object(
    'backfill_source', 'event_registrations',
    'refund_status', er.refund_status,
    'refund_percentage', er.refund_percentage
  ),
  COALESCE(er.cancelled_at, now())
FROM public.event_registrations er
WHERE er.user_id IS NOT NULL
  AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
  AND er.stripe_payment_intent_id IS NOT NULL
  AND COALESCE(er.refund_amount, 0) > 0
  AND er.refund_status = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_payment_transactions upt
    WHERE upt.registration_id = er.id
      AND upt.kind = 'refund'
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW public.admin_user_payment_summary
WITH (security_invoker = true)
AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE kind = 'payment')::integer AS payment_count,
  COUNT(*) FILTER (WHERE kind = 'refund')::integer AS refund_count,
  COALESCE(SUM(amount) FILTER (WHERE kind = 'payment'), 0)::numeric(10,2) AS gross_amount,
  COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0)::numeric(10,2) AS refunded_amount,
  (
    COALESCE(SUM(amount) FILTER (WHERE kind = 'payment'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0)
  )::numeric(10,2) AS net_amount,
  COALESCE(SUM(event_amount) FILTER (WHERE kind = 'payment'), 0)::numeric(10,2) AS event_amount,
  COALESCE(SUM(service_fee_amount) FILTER (WHERE kind = 'payment'), 0)::numeric(10,2) AS service_fee_amount,
  COALESCE(SUM(membership_fee_amount) FILTER (WHERE kind = 'payment'), 0)::numeric(10,2) AS membership_fee_amount,
  MAX(created_at) FILTER (WHERE kind = 'payment') AS last_payment_at,
  MAX(created_at) AS last_transaction_at
FROM public.user_payment_transactions
GROUP BY user_id;

GRANT SELECT ON public.user_payment_transactions TO authenticated;
GRANT SELECT ON public.admin_user_payment_summary TO authenticated;
GRANT ALL ON public.user_payment_transactions TO service_role;
