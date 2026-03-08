CREATE OR REPLACE FUNCTION public.award_badges_on_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_attended_count int;
  v_badge record;
  v_cat_count int;
BEGIN
  -- Only trigger on check-in (checked_in changed to true)
  IF NEW.checked_in = true AND (OLD.checked_in = false OR OLD.checked_in IS NULL) THEN
    v_user_id := NEW.user_id;
    
    -- Count total checked-in events for this user
    SELECT COUNT(*) INTO v_attended_count
    FROM event_registrations
    WHERE user_id = v_user_id
      AND checked_in = true
      AND status IN ('registered', 'paid');
    
    -- Award all progression badges (category IS NULL) the user qualifies for
    FOR v_badge IN
      SELECT id FROM badges
      WHERE category IS NULL
        AND required_events <= v_attended_count
    LOOP
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (v_user_id, v_badge.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END LOOP;
    
    -- Award "Scampagnatore Ufficiale" at 5+ events
    IF v_attended_count >= 5 THEN
      INSERT INTO user_badges (user_id, badge_id)
      SELECT v_user_id, id FROM badges WHERE name = 'Scampagnatore Ufficiale'
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
    
    -- Award category-specific badges
    FOR v_badge IN
      SELECT b.id, b.category, b.required_events
      FROM badges b
      WHERE b.category IS NOT NULL
        AND b.category != 'special'
    LOOP
      SELECT COUNT(*) INTO v_cat_count
      FROM event_registrations er
      JOIN events e ON e.id = er.event_id
      JOIN event_categories ec ON ec.id = e.category_id
      WHERE er.user_id = v_user_id
        AND er.checked_in = true
        AND er.status IN ('registered', 'paid')
        AND ec.name = v_badge.category;
      
      IF v_cat_count >= v_badge.required_events THEN
        INSERT INTO user_badges (user_id, badge_id)
        VALUES (v_user_id, v_badge.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END LOOP;
    
    -- Update total_points (1 point per attended event)
    UPDATE profiles SET total_points = v_attended_count WHERE id = v_user_id;
  END IF;
  
  RETURN NEW;
END;
$function$;