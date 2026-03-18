
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_avatar_url text;
BEGIN
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name := new.raw_user_meta_data->>'last_name';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_avatar_url := COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture');

  -- If first_name is null (e.g. Google OAuth), extract from full_name
  IF v_first_name IS NULL OR v_first_name = '' THEN
    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      v_first_name := split_part(v_full_name, ' ', 1);
      v_last_name := COALESCE(v_last_name, nullif(substr(v_full_name, length(split_part(v_full_name, ' ', 1)) + 2), ''));
    ELSE
      v_first_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User');
    END IF;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, phone, avatar_url, email)
  VALUES (
    new.id,
    COALESCE(v_first_name, 'User'),
    COALESCE(v_last_name, ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    v_avatar_url,
    new.email
  );
  RETURN new;
END;
$function$;
