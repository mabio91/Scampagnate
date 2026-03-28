-- Insert "Costante" badge
INSERT INTO badges (name, description, icon, required_events, requirement_type, requirement_value, category)
VALUES ('Costante', 'Partecipa a 3 eventi senza cancellazioni in un mese', '💪', 3, 'streak', 3, 'special')
ON CONFLICT DO NOTHING;

-- Insert "Costanza 3x" mission linked to the badge
INSERT INTO missions (
  title, description, icon, type, target_action, target_value,
  reward_points, reward_type, reward_badge_id,
  is_active, reset_on_failure
)
SELECT
  'Costanza 3x',
  'Partecipa a 3 eventi senza cancellazioni',
  '💪',
  'monthly',
  'event_attended',
  3,
  20,
  'badge',
  b.id,
  true,
  true
FROM badges b WHERE b.name = 'Costante'
LIMIT 1;