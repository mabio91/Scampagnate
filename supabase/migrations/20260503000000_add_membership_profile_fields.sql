ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS province_of_birth text,
ADD COLUMN IF NOT EXISTS city_of_residence text,
ADD COLUMN IF NOT EXISTS province_of_residence text;
