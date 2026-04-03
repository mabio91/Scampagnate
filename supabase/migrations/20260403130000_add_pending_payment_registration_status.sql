ALTER TYPE public.registration_status
ADD VALUE IF NOT EXISTS 'pending_payment';

UPDATE public.event_registrations er
SET status = 'pending_payment'
FROM public.events e
WHERE er.event_id = e.id
  AND er.status = 'registered'
  AND COALESCE(er.payment_status, 'pending') = 'pending'
  AND e.payment_type IN ('paid', 'deposit');
