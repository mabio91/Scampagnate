
-- Add flexible pricing columns to event_price_options
ALTER TABLE public.event_price_options 
  ADD COLUMN IF NOT EXISTS eligible_group text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS original_price numeric NULL,
  ADD COLUMN IF NOT EXISTS promo_start timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS promo_end timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false;

-- Add a comment for documentation
COMMENT ON COLUMN public.event_price_options.eligible_group IS 'Who can see/use this price: all, members, badge:<id>, custom';
COMMENT ON COLUMN public.event_price_options.original_price IS 'Original price before discount (for strikethrough display)';
COMMENT ON COLUMN public.event_price_options.promo_start IS 'Start of promotional pricing window';
COMMENT ON COLUMN public.event_price_options.promo_end IS 'End of promotional pricing window';
COMMENT ON COLUMN public.event_price_options.is_promotional IS 'Whether this is a time-limited promotional price';
