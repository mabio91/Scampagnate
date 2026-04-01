CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('terms', 'age', 'marketing', 'media')),
  granted boolean NOT NULL DEFAULT false,
  version text,
  granted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, consent_type)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own consents"
  ON public.user_consents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consents"
  ON public.user_consents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own optional consents"
  ON public.user_consents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND consent_type IN ('marketing', 'media'))
  WITH CHECK (auth.uid() = user_id AND consent_type IN ('marketing', 'media'));