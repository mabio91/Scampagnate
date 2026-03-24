
-- Fix overly permissive RLS policy on phone_otps
DROP POLICY IF EXISTS "Service can manage OTPs" ON public.phone_otps;

-- Users can only insert their own OTPs
CREATE POLICY "Users can insert own OTPs" ON public.phone_otps
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own OTPs
CREATE POLICY "Users can update own OTPs" ON public.phone_otps
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own OTPs
CREATE POLICY "Users can delete own OTPs" ON public.phone_otps
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
