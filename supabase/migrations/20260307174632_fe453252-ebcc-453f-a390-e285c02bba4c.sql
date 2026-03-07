
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reserved_spots integer NOT NULL DEFAULT 0;
