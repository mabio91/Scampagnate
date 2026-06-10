ALTER TABLE public.user_payment_transactions
  ADD COLUMN IF NOT EXISTS stripe_fee_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (stripe_fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS stripe_net_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS stripe_balance_transaction_id text;

CREATE INDEX IF NOT EXISTS user_payment_transactions_stripe_balance_tx_idx
  ON public.user_payment_transactions(stripe_balance_transaction_id)
  WHERE stripe_balance_transaction_id IS NOT NULL;

DROP VIEW IF EXISTS public.admin_user_payment_summary;

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
  COALESCE(SUM(stripe_fee_amount) FILTER (WHERE kind = 'payment'), 0)::numeric(10,2) AS stripe_fee_amount,
  (
    COALESCE(SUM(amount) FILTER (WHERE kind = 'payment'), 0)
    - COALESCE(SUM(amount) FILTER (WHERE kind = 'refund'), 0)
    - COALESCE(SUM(stripe_fee_amount) FILTER (WHERE kind = 'payment'), 0)
  )::numeric(10,2) AS stripe_net_amount,
  MAX(created_at) FILTER (WHERE kind = 'payment') AS last_payment_at,
  MAX(created_at) AS last_transaction_at
FROM public.user_payment_transactions
GROUP BY user_id;

GRANT SELECT ON public.admin_user_payment_summary TO authenticated;
