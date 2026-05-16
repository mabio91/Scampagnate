-- Update the trigger function to always set membership_registration_date on activation
CREATE OR REPLACE FUNCTION public.auto_generate_membership_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_id integer;
  max_attempts integer := 100;
  attempt integer := 0;
BEGIN
  IF NEW.membership_status = 'Active' AND (NEW.membership_id IS NULL) AND
     (OLD.membership_status IS DISTINCT FROM 'Active' OR OLD.membership_id IS NULL) THEN

    LOOP
      attempt := attempt + 1;
      next_id := floor(random() * 999000 + 1000)::integer;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE membership_id = next_id);
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Could not generate unique membership ID after % attempts', max_attempts;
      END IF;
    END LOOP;

    NEW.membership_id := next_id;
    NEW.membership_registration_date := now();
    NEW.membership_year := extract(year from now())::integer;
  END IF;

  RETURN NEW;
END;
$function$;