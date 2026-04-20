CREATE OR REPLACE FUNCTION public.prevent_manual_founding_member_badge_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  founding_badge_id uuid;
  allow_assignment text;
BEGIN
  SELECT id INTO founding_badge_id
  FROM public.badges
  WHERE name = 'Founding Member'
  LIMIT 1;

  IF founding_badge_id IS NULL THEN
    RETURN NEW;
  END IF;

  allow_assignment := current_setting('app.allow_founding_badge_assignment', true);

  IF NEW.badge_id = founding_badge_id AND COALESCE(allow_assignment, 'false') <> 'true' THEN
    RAISE EXCEPTION 'Founding Member badge can only be assigned automatically during membership activation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_manual_founding_member_badge_assignment ON public.user_badges;

CREATE TRIGGER trg_prevent_manual_founding_member_badge_assignment
BEFORE INSERT OR UPDATE OF badge_id ON public.user_badges
FOR EACH ROW
EXECUTE FUNCTION public.prevent_manual_founding_member_badge_assignment();

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
  current_subscription_order integer;
  assigned_subscription_order integer;
  founding_badge_id uuid;
  qualifies_founding boolean := false;
BEGIN
  SELECT membership_id, membership_subscription_order
  INTO current_membership_id, current_subscription_order
  FROM public.profiles
  WHERE id = user_id_param
  FOR UPDATE;

  IF current_membership_id IS NULL THEN
    LOOP
      attempt := attempt + 1;
      next_id := floor(random() * 999000 + 1000)::integer;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE membership_id = next_id);
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Could not generate unique membership ID after % attempts', max_attempts;
      END IF;
    END LOOP;
  ELSE
    next_id := current_membership_id;
  END IF;

  IF current_subscription_order IS NULL THEN
    SELECT COALESCE(MAX(membership_subscription_order), 0) + 1
    INTO assigned_subscription_order
    FROM public.profiles;
  ELSE
    assigned_subscription_order := current_subscription_order;
  END IF;

  qualifies_founding := current_subscription_order IS NULL AND assigned_subscription_order <= 150;

  UPDATE public.profiles
  SET
    membership_id = next_id,
    membership_status = 'Active',
    membership_registration_date = CASE
      WHEN current_membership_id IS NULL THEN now()
      ELSE COALESCE(membership_registration_date, now())
    END,
    membership_year = extract(year FROM now())::integer,
    membership_subscription_order = COALESCE(current_subscription_order, assigned_subscription_order),
    is_founding_member = CASE
      WHEN qualifies_founding THEN true
      WHEN current_subscription_order IS NULL THEN false
      ELSE is_founding_member
    END
  WHERE id = user_id_param;

  SELECT id INTO founding_badge_id
  FROM public.badges
  WHERE name = 'Founding Member'
  LIMIT 1;

  IF founding_badge_id IS NOT NULL THEN
    IF qualifies_founding THEN
      PERFORM set_config('app.allow_founding_badge_assignment', 'true', true);

      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (user_id_param, founding_badge_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    ELSE
      DELETE FROM public.user_badges
      WHERE user_id = user_id_param
        AND badge_id = founding_badge_id
        AND COALESCE(current_subscription_order, assigned_subscription_order) > 150;
    END IF;
  END IF;
END;
$function$;
