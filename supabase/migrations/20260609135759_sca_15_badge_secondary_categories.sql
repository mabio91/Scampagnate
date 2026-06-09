CREATE OR REPLACE FUNCTION public.count_user_attended_events_in_category(
  p_user_id uuid,
  p_category text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT er.event_id)::integer
  FROM public.event_registrations er
  JOIN public.events e ON e.id = er.event_id
  LEFT JOIN public.event_categories ec ON ec.id = e.category_id
  WHERE er.user_id = p_user_id
    AND er.event_id IS NOT NULL
    AND COALESCE(er.sport_level, '') NOT LIKE 'manual:%'
    AND (er.checked_in = true OR er.status = 'attended')
    AND er.status IN ('registered', 'deposit_paid', 'paid', 'attended')
    AND (
      ec.name = p_category
      OR e.additional_fields ->> 'fit_score_main_category' = p_category
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(e.additional_fields -> 'fit_score_secondary_categories') = 'array'
              THEN e.additional_fields -> 'fit_score_secondary_categories'
            ELSE '[]'::jsonb
          END
        ) AS secondary_category(name)
        WHERE secondary_category.name = p_category
      )
    );
$$;

ALTER FUNCTION public.count_user_attended_events_in_category(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text) TO anon;
GRANT ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.count_user_attended_events_in_category(uuid, text) TO service_role;
