
-- Insert Scampagnatore Ufficiale badge (special community badge at 5+ events)
INSERT INTO badges (name, description, icon, category, required_events)
VALUES ('Scampagnatore Ufficiale', 'Membro ufficiale della community', '🏅', 'special', 5)
ON CONFLICT DO NOTHING;

-- Create function to auto-award badges on check-in
CREATE OR REPLACE FUNCTION public.award_badges_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_attended_count int;
  v_badge record;
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
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Award "Scampagnatore Ufficiale" at 5+ events
    IF v_attended_count >= 5 THEN
      INSERT INTO user_badges (user_id, badge_id)
      SELECT v_user_id, id FROM badges WHERE name = 'Scampagnatore Ufficiale'
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Update total_points (1 point per attended event)
    UPDATE profiles SET total_points = v_attended_count WHERE id = v_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on event_registrations for check-in
DROP TRIGGER IF EXISTS award_badges_trigger ON event_registrations;
CREATE TRIGGER award_badges_trigger
  AFTER UPDATE ON event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION award_badges_on_checkin();

-- Add unique constraint on user_badges to support ON CONFLICT
ALTER TABLE user_badges ADD CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id);
