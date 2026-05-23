-- Clean up Cacciatore di Stelle rewards that were awarded before
-- secondary_category_names filters were enforced by mission sync.

CREATE TEMP TABLE invalid_star_hunter_users (
  user_id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO invalid_star_hunter_users (user_id)
VALUES
  ('08570dd3-3125-4dc0-8504-9d5cb7c0b83e'),
  ('1eb38a02-72e9-4456-9fea-9bc628d6e67b'),
  ('4b9ede6b-6252-4ed5-8819-eaa6c601eb16'),
  ('52dc2fe9-8892-4f12-9ce0-56b59dd0e2cc'),
  ('64099a6e-d395-4607-9601-85392b2a436e'),
  ('c87e48b1-61bb-4fb8-9619-f69e8d1c3e54'),
  ('db1cdcae-f8ab-4cdf-9066-3ce297c2d5a9'),
  ('c9aac1af-0a7c-4604-9b7e-07b0a95a0c18'),
  ('ac63cc83-6cb4-44dd-99d2-9860e9b1e072'),
  ('4d8c28a8-a348-494c-84bf-ccb3e6de1aa3'),
  ('aaba5b2a-0811-430f-aa6a-9040eda7e4f4'),
  ('968b80e3-6344-4f7a-bd02-1b1fcf2c1296'),
  ('ce87c5a5-d0a1-4a73-98bf-7cb6e8139861'),
  ('543f7392-1407-4b45-9276-edb509332e51'),
  ('77121b99-9792-4a63-a2c7-7468fdbce91a'),
  ('0384b5b9-6043-4ce1-9d06-392aa7c0d13f'),
  ('579312c3-c29a-4768-9841-4adce616ae19'),
  ('d8d9e543-6102-41e5-82a9-504e7694b6e3'),
  ('9b5a9fd2-2702-43e0-bb40-e39dee3b8570'),
  ('8a0e22ec-9c4f-4acf-b4b4-d5fbc0bfa64e'),
  ('e965f2c0-767a-4131-99e7-900bc26014f0'),
  ('96745e72-5ce2-485f-9c3a-05ff3645e944')
ON CONFLICT DO NOTHING;

DELETE FROM public.points_history ph
USING invalid_star_hunter_users u
WHERE ph.user_id = u.user_id
  AND ph.type = 'mission_reward'
  AND ph.reference_id = 'ae409ced-0cbd-43dc-8d92-81dce6021ac8'
  AND ph.value = 75;

DELETE FROM public.points_history ph
USING invalid_star_hunter_users u
WHERE ph.user_id = u.user_id
  AND ph.type = 'admin_manual'
  AND ph.value = -75
  AND ph.description = 'errata assegnazione'
  AND ph.created_at >= '2026-05-23 19:00:00+00'::timestamptz
  AND ph.created_at < '2026-05-23 20:00:00+00'::timestamptz;

DELETE FROM public.user_badges ub
USING invalid_star_hunter_users u
WHERE ub.user_id = u.user_id
  AND ub.badge_id = '60dde743-8327-47a7-ab16-80b0f6e71883';

DELETE FROM public.user_rewards ur
USING invalid_star_hunter_users u
WHERE ur.user_id = u.user_id
  AND ur.source_mission_reward_id IN (
    '09b7f08c-fa85-443c-b764-8722688410be',
    'ae409ced-0cbd-43dc-8d92-81dce6021ac8'
  );

DELETE FROM public.notifications n
USING invalid_star_hunter_users u
WHERE n.user_id = u.user_id
  AND n.title = 'Missione completata'
  AND n.type = 'success'
  AND n.message IN (
    'Hai sbloccato badge Cacciatore di stelle, +75 punti.',
    'Hai sbloccato badge Cacciatore di stelle.'
  )
  AND n.created_at >= '2026-05-23 18:00:00+00'::timestamptz
  AND n.created_at < '2026-05-23 21:00:00+00'::timestamptz;

UPDATE public.user_missions um
SET
  progress = 0,
  completed = false,
  completed_at = NULL,
  reward_details = NULL
FROM invalid_star_hunter_users u
WHERE um.user_id = u.user_id
  AND um.mission_id = 'd5ce39ba-7913-4548-a8d6-3bdd3441154d';

UPDATE public.user_mission_progress ump
SET
  current_value = 0,
  completion_count = 0,
  is_completed = false,
  completed_at = NULL,
  last_progress_at = now()
FROM invalid_star_hunter_users u
WHERE ump.user_id = u.user_id
  AND ump.mission_id = 'd5ce39ba-7913-4548-a8d6-3bdd3441154d';

DO $$
DECLARE
  target_user_id uuid;
BEGIN
  FOR target_user_id IN
    SELECT user_id
    FROM invalid_star_hunter_users
  LOOP
    PERFORM public.recalculate_user_total_points(target_user_id);
  END LOOP;
END;
$$;
