
-- Add phone verification fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS phone_verification_method text;

-- Create phone OTPs table
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  otp_hash text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false
);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OTPs" ON public.phone_otps
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can manage OTPs" ON public.phone_otps
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
