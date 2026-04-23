DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'balance_payment_mode'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.balance_payment_mode AS ENUM ('online', 'on_site');
  END IF;
END $$;

ALTER TYPE public.registration_status
ADD VALUE IF NOT EXISTS 'deposit_paid';

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS balance_payment_mode public.balance_payment_mode;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_place text,
ADD COLUMN IF NOT EXISTS residential_address text;

ALTER TABLE public.event_registrations
ADD COLUMN IF NOT EXISTS total_price_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS balance_due_amount numeric(10,2),
ADD COLUMN IF NOT EXISTS balance_payment_mode public.balance_payment_mode,
ADD COLUMN IF NOT EXISTS last_balance_reminder_sent_at timestamptz;

UPDATE public.events
SET balance_payment_mode = 'online'
WHERE payment_type = 'deposit'
  AND balance_payment_mode IS NULL;

UPDATE public.event_registrations er
SET total_price_amount = COALESCE(er.total_price_amount, e.price),
    deposit_amount = COALESCE(er.deposit_amount, e.deposit),
    balance_due_amount = COALESCE(
      er.balance_due_amount,
      GREATEST(COALESCE(e.price, 0) - COALESCE(er.amount_paid, 0), 0)
    ),
    balance_payment_mode = COALESCE(er.balance_payment_mode, e.balance_payment_mode)
FROM public.events e
WHERE e.id = er.event_id
  AND e.payment_type = 'deposit';

UPDATE public.event_registrations er
SET status = 'deposit_paid',
    payment_status = 'deposit_paid',
    total_price_amount = COALESCE(er.total_price_amount, e.price),
    deposit_amount = COALESCE(er.deposit_amount, e.deposit),
    balance_due_amount = GREATEST(COALESCE(e.price, 0) - COALESCE(er.amount_paid, 0), 0),
    balance_payment_mode = COALESCE(er.balance_payment_mode, e.balance_payment_mode)
FROM public.events e
WHERE e.id = er.event_id
  AND e.payment_type = 'deposit'
  AND er.status = 'paid'
  AND COALESCE(er.amount_paid, 0) < COALESCE(e.price, 0);
