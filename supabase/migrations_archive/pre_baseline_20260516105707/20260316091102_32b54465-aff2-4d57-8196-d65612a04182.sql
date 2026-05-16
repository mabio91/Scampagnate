
CREATE OR REPLACE FUNCTION public.activate_membership(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  next_id integer;
  max_attempts integer := 100;
  attempt integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id_param AND membership_status = 'Active') THEN
    RETURN;
  END IF;

  LOOP
    attempt := attempt + 1;
    next_id := floor(random() * 999000 + 1000)::integer;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE membership_id = next_id);
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique membership ID after % attempts', max_attempts;
    END IF;
  END LOOP;

  UPDATE profiles
  SET 
    membership_id = next_id,
    membership_status = 'Active',
    membership_registration_date = now(),
    membership_year = extract(year from now())::integer
  WHERE id = user_id_param;
END;
$function$;
