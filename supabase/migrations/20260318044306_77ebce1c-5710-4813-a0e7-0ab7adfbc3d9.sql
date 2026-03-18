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
  current_year integer := extract(year from now())::integer;
BEGIN
  -- Check if already active for the current year
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id_param 
      AND membership_status = 'Active' 
      AND membership_year = current_year
  ) THEN
    RETURN;
  END IF;

  -- Check if user already has a membership_id (renewal)
  SELECT membership_id INTO current_membership_id
  FROM profiles WHERE id = user_id_param;

  -- Only generate a new ID if the user never had one
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

  UPDATE profiles
  SET 
    membership_id = next_id,
    membership_status = 'Active',
    membership_registration_date = CASE 
      WHEN current_membership_id IS NULL THEN now()
      ELSE membership_registration_date
    END,
    membership_year = current_year
  WHERE id = user_id_param;
END;
$function$;