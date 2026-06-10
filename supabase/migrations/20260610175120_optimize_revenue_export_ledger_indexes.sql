CREATE INDEX IF NOT EXISTS user_payment_transactions_created_at_idx
  ON public.user_payment_transactions(created_at);

CREATE INDEX IF NOT EXISTS user_payment_transactions_event_created_idx
  ON public.user_payment_transactions(event_id, created_at)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_payment_transactions_payment_intent_idx
  ON public.user_payment_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
