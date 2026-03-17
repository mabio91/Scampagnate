
-- Add starts_at for validity period start
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS starts_at timestamp with time zone DEFAULT NULL;

-- Add assigned_user_id for user-specific codes
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS assigned_user_id uuid DEFAULT NULL;

-- Add is_single_use flag for personalized single-use codes
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS is_single_use boolean NOT NULL DEFAULT false;

-- Index for quick lookup of user-specific codes
CREATE INDEX IF NOT EXISTS idx_discount_codes_assigned_user ON public.discount_codes(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
