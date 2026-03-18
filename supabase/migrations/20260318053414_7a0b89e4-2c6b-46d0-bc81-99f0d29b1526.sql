-- Add founding member flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_founding_member boolean NOT NULL DEFAULT false;

-- Insert the Founding Member badge
INSERT INTO badges (name, description, icon, category, required_events)
VALUES ('Founding Member', 'Among the first 150 members to join the community', 'crown', 'special', 0)
ON CONFLICT DO NOTHING;

-- Update activate_membership to auto-assign founding member for first 150
CREATE OR REPLACE FUNCTION public.activate_membership(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_id integer;
  max_attempts integer := 100;
  attempt integer := 0;
  current_membership_id integer;
  total_members integer;
  founding_badge_id uuid;
BEGIN
  SELECT membership_id INTO current_membership_id
  FROM profiles WHERE id = user_id_param;

  IF current_membership_id IS NULL THEN
    LOOP
      attempt := attempt + 1;
      next_id := floor(random() * 999000 + 1000)::integer;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE membership_id = next_id);
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Could not generate unique membership ID after % attempts', max_attempts;
      END IF;
    END LOOP;
  ELSE
    next_id := current_membership_id;
  END IF;

  -- Count existing members (with membership_id) to determine founding status
  SELECT COUNT(*) INTO total_members FROM profiles WHERE membership_id IS NOT NULL AND id != user_id_param;

  UPDATE profiles
  SET 
    membership_id = next_id,
    membership_status = 'Active',
    membership_registration_date = now(),
    membership_year = extract(year from now())::integer,
    is_founding_member = CASE 
      WHEN current_membership_id IS NULL AND total_members < 150 THEN true 
      ELSE is_founding_member 
    END
  WHERE id = user_id_param;

  -- Auto-award founding member badge
  IF current_membership_id IS NULL AND total_members < 150 THEN
    SELECT id INTO founding_badge_id FROM badges WHERE name = 'Founding Member' LIMIT 1;
    IF founding_badge_id IS NOT NULL THEN
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (user_id_param, founding_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
END;
$function$;

-- Backfill existing members as founding members (they are the first ones)
UPDATE profiles SET is_founding_member = true WHERE membership_id IS NOT NULL;