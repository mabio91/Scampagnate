-- Exclude the requested users from completing Cacciatore di Stelle only
-- through the Terminillo 2 in 1 event. Future qualifying events still count.

CREATE TABLE IF NOT EXISTS public.mission_event_participation_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT mission_event_participation_exclusions_unique UNIQUE (mission_id, event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_event_participation_exclusions_lookup
  ON public.mission_event_participation_exclusions (user_id, mission_id, event_id);

ALTER TABLE public.mission_event_participation_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage mission event participation exclusions"
  ON public.mission_event_participation_exclusions;

CREATE POLICY "Admins can manage mission event participation exclusions"
  ON public.mission_event_participation_exclusions
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON TABLE public.mission_event_participation_exclusions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mission_event_participation_exclusions TO authenticated;
GRANT ALL ON TABLE public.mission_event_participation_exclusions TO service_role;

INSERT INTO public.mission_event_participation_exclusions (
  mission_id,
  event_id,
  user_id,
  reason
)
VALUES
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'b6298b9c-c60e-428c-8e39-05fe4c02f7ef', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', '77121b99-9792-4a63-a2c7-7468fdbce91a', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'c6736bd9-8980-4f8e-8be1-a53e02d8e8d7', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'f5473515-97d4-41fa-adef-8d051591b1b2', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', '63388a75-99ea-4c67-83e7-a901f82adb90', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'a2893786-ee65-4e9d-8195-cfc83aa605cb', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', '0a29d4bf-af3d-4610-aa05-ea34fd9e49eb', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'fe0797c2-5578-4bab-ae62-2da85ea3f8cc', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'd08c4951-7ae2-4142-8b2e-9ce6f8d3599a', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', '968b80e3-6344-4f7a-bd02-1b1fcf2c1296', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'e965f2c0-767a-4131-99e7-900bc26014f0', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', '735b909a-1e99-44b9-9479-8360d07baa2a', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event'),
  ('d5ce39ba-7913-4548-a8d6-3bdd3441154d', '5366cfea-f2e8-48a5-9cff-8b16f319313d', 'ecf2686c-849c-4f8e-ab5d-29b0c8abe002', 'Excluded from Cacciatore di Stelle for Terminillo 2 in 1 event')
ON CONFLICT (mission_id, event_id, user_id)
DO UPDATE SET reason = EXCLUDED.reason;

CREATE OR REPLACE FUNCTION public.sync_user_missions_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_row record;
  progress_count integer;
  capped_progress integer;
  completed_flag boolean;
  cycle_key_value text;
  progress_row_id uuid;
  cycle_start_value timestamptz;
  cycle_end_value timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  FOR mission_row IN
    SELECT
      m.id,
      m.type,
      m.title,
      m.target_value,
      m.target_action,
      m.category,
      m.category_filter,
      coalesce(nullif(m.timezone, ''), 'Europe/Rome') AS timezone,
      coalesce(mc.event_filters, '{}'::jsonb) AS event_filters
    FROM public.missions m
    LEFT JOIN LATERAL (
      SELECT event_filters
      FROM public.mission_conditions
      WHERE mission_id = m.id
      ORDER BY sort_order ASC
      LIMIT 1
    ) mc ON true
    WHERE m.is_active = true
      AND coalesce(m.is_archived, false) = false
      AND coalesce(m.status, 'active') NOT IN ('archived', 'draft')
    ORDER BY m.sort_order ASC, m.created_at ASC
  LOOP
    cycle_key_value := public.compute_mission_cycle_key(mission_row.type, mission_row.timezone);

    cycle_start_value := CASE lower(coalesce(mission_row.type, ''))
      WHEN 'monthly' THEN date_trunc('month', timezone(mission_row.timezone, now())) AT TIME ZONE mission_row.timezone
      WHEN 'weekly' THEN date_trunc('week', timezone(mission_row.timezone, now())) AT TIME ZONE mission_row.timezone
      ELSE now()
    END;

    cycle_end_value := CASE lower(coalesce(mission_row.type, ''))
      WHEN 'monthly' THEN (date_trunc('month', timezone(mission_row.timezone, now())) + interval '1 month') AT TIME ZONE mission_row.timezone
      WHEN 'weekly' THEN (date_trunc('week', timezone(mission_row.timezone, now())) + interval '1 week') AT TIME ZONE mission_row.timezone
      ELSE NULL
    END;

    IF mission_row.target_action = 'first_event_ever' THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      WHERE er.user_id = p_user_id
        AND er.event_id IS NOT NULL
        AND (er.checked_in = true OR er.status = 'attended')
        AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
        AND NOT EXISTS (
          SELECT 1
          FROM public.mission_event_participation_exclusions mepe
          WHERE mepe.user_id = p_user_id
            AND mepe.mission_id = mission_row.id
            AND mepe.event_id = er.event_id
        );
    ELSIF mission_row.target_action IN ('event_attended', 'event_attendance', 'category_participation') THEN
      SELECT count(DISTINCT er.event_id)::integer
      INTO progress_count
      FROM public.event_registrations er
      JOIN public.events e ON e.id = er.event_id
      LEFT JOIN public.event_categories ec ON ec.id = e.category_id
      WHERE er.user_id = p_user_id
        AND er.event_id IS NOT NULL
        AND (er.checked_in = true OR er.status = 'attended')
        AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
        AND NOT EXISTS (
          SELECT 1
          FROM public.mission_event_participation_exclusions mepe
          WHERE mepe.user_id = p_user_id
            AND mepe.mission_id = mission_row.id
            AND mepe.event_id = er.event_id
        )
        AND (
          CASE lower(coalesce(mission_row.type, ''))
            WHEN 'monthly' THEN to_char(e.date, 'YYYY-MM') = cycle_key_value
            WHEN 'weekly' THEN to_char(e.date, 'IYYY-"W"IW') = cycle_key_value
            ELSE true
          END
        )
        AND (
          (
            coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)), 0) = 0
            AND coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)), 0) = 0
            AND coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '') = ''
            AND coalesce(array_length(mission_row.category_filter, 1), 0) = 0
          )
          OR ec.id IN (
            SELECT value::uuid
            FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'category_ids', '[]'::jsonb)) AS value
          )
          OR ec.name IN (
            SELECT value
            FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'category_names', '[]'::jsonb)) AS value
          )
          OR ec.name = coalesce(nullif(mission_row.event_filters ->> 'legacy_category', ''), mission_row.category, '')
          OR ec.name = ANY(coalesce(mission_row.category_filter, ARRAY[]::text[]))
        )
        AND (
          coalesce(jsonb_array_length(coalesce(mission_row.event_filters -> 'secondary_category_names', '[]'::jsonb)), 0) = 0
          OR e.additional_fields ->> 'fit_score_main_category' IN (
            SELECT value
            FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'secondary_category_names', '[]'::jsonb)) AS value
          )
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(coalesce(e.additional_fields -> 'fit_score_secondary_categories', '[]'::jsonb)) AS event_secondary(value)
            WHERE event_secondary.value IN (
              SELECT value
              FROM jsonb_array_elements_text(coalesce(mission_row.event_filters -> 'secondary_category_names', '[]'::jsonb)) AS selected_secondary(value)
            )
          )
        );
    ELSE
      progress_count := 0;
    END IF;

    capped_progress := least(coalesce(progress_count, 0), greatest(coalesce(mission_row.target_value, 1), 1));
    completed_flag := capped_progress >= greatest(coalesce(mission_row.target_value, 1), 1);

    INSERT INTO public.user_missions (
      user_id,
      mission_id,
      progress,
      completed,
      completed_at,
      reward_details
    )
    VALUES (
      p_user_id,
      mission_row.id,
      capped_progress,
      completed_flag,
      CASE WHEN completed_flag THEN now() ELSE NULL END,
      NULL
    )
    ON CONFLICT (user_id, mission_id)
    DO UPDATE SET
      progress = EXCLUDED.progress,
      completed = EXCLUDED.completed,
      completed_at = CASE
        WHEN NOT EXCLUDED.completed THEN NULL
        WHEN lower(coalesce(mission_row.type, '')) IN ('monthly', 'weekly') THEN
          CASE
            WHEN public.user_missions.completed_at >= cycle_start_value
              AND (cycle_end_value IS NULL OR public.user_missions.completed_at < cycle_end_value)
            THEN public.user_missions.completed_at
            ELSE now()
          END
        ELSE coalesce(public.user_missions.completed_at, now())
      END
    RETURNING id INTO progress_row_id;

    INSERT INTO public.user_mission_progress (
      user_id,
      mission_id,
      cycle_key,
      current_value,
      target_value,
      completion_count,
      is_completed,
      is_locked,
      is_expired,
      started_at,
      completed_at,
      last_progress_at,
      cycle_started_at,
      cycle_ends_at,
      state,
      legacy_user_mission_id
    )
    VALUES (
      p_user_id,
      mission_row.id,
      cycle_key_value,
      capped_progress,
      greatest(coalesce(mission_row.target_value, 1), 1),
      CASE WHEN completed_flag THEN 1 ELSE 0 END,
      completed_flag,
      false,
      false,
      now(),
      CASE WHEN completed_flag THEN now() ELSE NULL END,
      now(),
      cycle_start_value,
      cycle_end_value,
      '{}'::jsonb,
      progress_row_id
    )
    ON CONFLICT (user_id, mission_id, cycle_key)
    DO UPDATE SET
      current_value = EXCLUDED.current_value,
      target_value = EXCLUDED.target_value,
      completion_count = EXCLUDED.completion_count,
      is_completed = EXCLUDED.is_completed,
      is_locked = false,
      is_expired = false,
      completed_at = CASE
        WHEN EXCLUDED.is_completed THEN coalesce(public.user_mission_progress.completed_at, now())
        ELSE NULL
      END,
      last_progress_at = now(),
      cycle_started_at = coalesce(public.user_mission_progress.cycle_started_at, EXCLUDED.cycle_started_at),
      cycle_ends_at = EXCLUDED.cycle_ends_at,
      legacy_user_mission_id = EXCLUDED.legacy_user_mission_id,
      updated_at = now();

    IF completed_flag THEN
      PERFORM public.award_mission_rewards(p_user_id, mission_row.id, true);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_missions_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_user_missions_for_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sync_user_missions_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_missions_for_user(uuid) TO service_role;

CREATE TEMP TABLE target_star_hunter_users (
  user_id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO target_star_hunter_users (user_id)
VALUES
  ('b6298b9c-c60e-428c-8e39-05fe4c02f7ef'),
  ('77121b99-9792-4a63-a2c7-7468fdbce91a'),
  ('c6736bd9-8980-4f8e-8be1-a53e02d8e8d7'),
  ('f5473515-97d4-41fa-adef-8d051591b1b2'),
  ('63388a75-99ea-4c67-83e7-a901f82adb90'),
  ('a2893786-ee65-4e9d-8195-cfc83aa605cb'),
  ('0a29d4bf-af3d-4610-aa05-ea34fd9e49eb'),
  ('fe0797c2-5578-4bab-ae62-2da85ea3f8cc'),
  ('d08c4951-7ae2-4142-8b2e-9ce6f8d3599a'),
  ('968b80e3-6344-4f7a-bd02-1b1fcf2c1296'),
  ('e965f2c0-767a-4131-99e7-900bc26014f0'),
  ('735b909a-1e99-44b9-9479-8360d07baa2a'),
  ('ecf2686c-849c-4f8e-ab5d-29b0c8abe002')
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
