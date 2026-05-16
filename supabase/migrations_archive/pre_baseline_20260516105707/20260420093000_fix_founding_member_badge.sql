ALTER TABLE public.badges
ADD COLUMN IF NOT EXISTS requirement_type text,
ADD COLUMN IF NOT EXISTS requirement_value integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS membership_subscription_order integer;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_membership_subscription_order_key
ON public.profiles (membership_subscription_order)
WHERE membership_subscription_order IS NOT NULL;

WITH ordered_members AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY
        COALESCE(membership_registration_date, created_at),
        created_at,
        id
    ) AS subscription_order
  FROM public.profiles
  WHERE membership_id IS NOT NULL
)
UPDATE public.profiles p
SET membership_subscription_order = om.subscription_order
FROM ordered_members om
WHERE p.id = om.id
  AND p.membership_subscription_order IS NULL;

UPDATE public.badges
SET
  description = 'Uno dei primi 150 membri della ASD Gruppo Scampagnate',
  required_events = 1,
  requirement_type = 'membership_first_150',
  requirement_value = 150,
  category = 'special'
WHERE name = 'Founding Member';

INSERT INTO public.badges (
  name,
  description,
  icon,
  required_events,
  requirement_type,
  requirement_value,
  category
)
SELECT
  'Founding Member',
  'Uno dei primi 150 membri della ASD Gruppo Scampagnate',
  'crown',
  1,
  'membership_first_150',
  150,
  'special'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.badges
  WHERE name = 'Founding Member'
);

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

UPDATE public.profiles
SET is_founding_member = membership_subscription_order IS NOT NULL
  AND membership_subscription_order <= 150;

INSERT INTO public.user_badges (user_id, badge_id)
SELECT p.id, b.id
FROM public.profiles p
CROSS JOIN public.badges b
WHERE b.name = 'Founding Member'
  AND p.membership_subscription_order IS NOT NULL
  AND p.membership_subscription_order <= 150
ON CONFLICT (user_id, badge_id) DO NOTHING;

DELETE FROM public.user_badges ub
USING public.badges b, public.profiles p
WHERE ub.badge_id = b.id
  AND ub.user_id = p.id
  AND b.name = 'Founding Member'
  AND (
    p.membership_subscription_order IS NULL
    OR p.membership_subscription_order > 150
  );
