CREATE TABLE IF NOT EXISTS public.registration_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  change_request_id uuid,
  kind text NOT NULL CHECK (kind IN ('payment', 'refund')),
  source text NOT NULL DEFAULT 'event_checkout',
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'eur',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.registration_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_price_option_id uuid REFERENCES public.event_price_options(id) ON DELETE SET NULL,
  new_price_option_id uuid NOT NULL REFERENCES public.event_price_options(id) ON DELETE RESTRICT,
  old_payment_type text,
  new_payment_type text NOT NULL,
  old_total_amount numeric(10,2) NOT NULL DEFAULT 0,
  new_total_amount numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid_before numeric(10,2) NOT NULL DEFAULT 0,
  service_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  event_paid_before numeric(10,2) NOT NULL DEFAULT 0,
  target_event_paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  additional_payment_amount numeric(10,2) NOT NULL DEFAULT 0,
  refund_amount numeric(10,2) NOT NULL DEFAULT 0,
  new_amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  new_balance_due_amount numeric(10,2) NOT NULL DEFAULT 0,
  new_deposit_amount numeric(10,2),
  new_balance_payment_mode public.balance_payment_mode,
  new_payment_status text NOT NULL,
  new_registration_status public.registration_status NOT NULL,
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'requires_payment', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_payment_transactions
  ADD CONSTRAINT registration_payment_transactions_change_request_id_fkey
  FOREIGN KEY (change_request_id)
  REFERENCES public.registration_change_requests(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registration_change_requests_active_unique
  ON public.registration_change_requests(registration_id)
  WHERE status IN ('requires_payment', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS registration_payment_transactions_checkout_kind_unique
  ON public.registration_payment_transactions(stripe_checkout_session_id, kind)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registration_payment_transactions_refund_unique
  ON public.registration_payment_transactions(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS registration_payment_transactions_registration_idx
  ON public.registration_payment_transactions(registration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS registration_change_requests_user_idx
  ON public.registration_change_requests(user_id, created_at DESC);

ALTER TABLE public.registration_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment transactions"
  ON public.registration_payment_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own registration change requests"
  ON public.registration_change_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage payment transactions"
  ON public.registration_payment_transactions
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can manage registration change requests"
  ON public.registration_change_requests
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.registration_payment_transactions TO authenticated;
GRANT SELECT ON public.registration_change_requests TO authenticated;
GRANT ALL ON public.registration_payment_transactions TO service_role;
GRANT ALL ON public.registration_change_requests TO service_role;
