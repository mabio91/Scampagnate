-- Remove the Cacciatore di Stelle mission completion and rewards from the
-- explicitly requested users. This is a one-off production data correction.

CREATE TEMP TABLE target_star_hunter_users (
  user_id uuid PRIMARY KEY,
  requested_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO target_star_hunter_users (user_id, requested_name)
VALUES
  ('b6298b9c-c60e-428c-8e39-05fe4c02f7ef', 'Ilaria Menichini'),
  ('77121b99-9792-4a63-a2c7-7468fdbce91a', 'Matteo Conti'),
  ('c6736bd9-8980-4f8e-8be1-a53e02d8e8d7', 'Matteo Camarca'),
  ('f5473515-97d4-41fa-adef-8d051591b1b2', 'Matteo Pompei'),
  ('63388a75-99ea-4c67-83e7-a901f82adb90', 'Alessio Fersula'),
  ('a2893786-ee65-4e9d-8195-cfc83aa605cb', 'Noemi De Lume'),
  ('0a29d4bf-af3d-4610-aa05-ea34fd9e49eb', 'Rosalba Giordano'),
  ('fe0797c2-5578-4bab-ae62-2da85ea3f8cc', 'Chiara Mazzuca Mari'),
  ('d08c4951-7ae2-4142-8b2e-9ce6f8d3599a', 'Maddalena De Angelis'),
  ('968b80e3-6344-4f7a-bd02-1b1fcf2c1296', 'Isabella De Rosis Morgia'),
  ('e965f2c0-767a-4131-99e7-900bc26014f0', 'Simone Spada'),
  ('735b909a-1e99-44b9-9479-8360d07baa2a', 'Giulio Pugliese'),
  ('ecf2686c-849c-4f8e-ab5d-29b0c8abe002', 'Michele Valenzi')
ON CONFLICT DO NOTHING;

DELETE FROM public.points_history ph
USING target_star_hunter_users u
WHERE ph.user_id = u.user_id
  AND ph.type = 'mission_reward'
  AND ph.reference_id = 'ae409ced-0cbd-43dc-8d92-81dce6021ac8'
  AND ph.value = 75;

DELETE FROM public.user_rewards ur
USING target_star_hunter_users u
WHERE ur.user_id = u.user_id
  AND (
    ur.mission_id = 'd5ce39ba-7913-4548-a8d6-3bdd3441154d'
    OR ur.source_mission_reward_id IN (
      '09b7f08c-fa85-443c-b764-8722688410be',
      'ae409ced-0cbd-43dc-8d92-81dce6021ac8'
    )
  );

DELETE FROM public.user_badges ub
USING target_star_hunter_users u
WHERE ub.user_id = u.user_id
  AND ub.badge_id = '60dde743-8327-47a7-ab16-80b0f6e71883';

DELETE FROM public.notifications n
USING target_star_hunter_users u
WHERE n.user_id = u.user_id
  AND n.type = 'success'
  AND n.title = 'Missione completata'
  AND (
    n.message = 'Hai sbloccato badge Cacciatore di stelle, +75 punti.'
    OR n.message = 'Hai sbloccato badge Cacciatore di stelle.'
  );

UPDATE public.user_missions um
SET
  progress = 0,
  completed = false,
  completed_at = NULL,
  reward_details = NULL
FROM target_star_hunter_users u
WHERE um.user_id = u.user_id
  AND um.mission_id = 'd5ce39ba-7913-4548-a8d6-3bdd3441154d';

UPDATE public.user_mission_progress ump
SET
  current_value = 0,
  completion_count = 0,
  is_completed = false,
  completed_at = NULL,
  reward_details = NULL,
  last_progress_at = now(),
  updated_at = now()
FROM target_star_hunter_users u
WHERE ump.user_id = u.user_id
  AND ump.mission_id = 'd5ce39ba-7913-4548-a8d6-3bdd3441154d';

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  FOR target_user_id IN
    SELECT user_id
    FROM target_star_hunter_users
  LOOP
    PERFORM public.recalculate_user_total_points(target_user_id);
  END LOOP;
END;
$$;
