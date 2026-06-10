WITH target_badge AS (
  SELECT id, category, required_events, event_filters
  FROM public.badges
  WHERE name = 'Spirito d''Avventura'
    AND category = 'Trekking & Outdoor'
),
stale_badges AS (
  SELECT ub.user_id, ub.badge_id
  FROM public.user_badges ub
  JOIN target_badge tb ON tb.id = ub.badge_id
  WHERE public.count_user_attended_events_in_category(
    ub.user_id,
    tb.category,
    COALESCE(tb.event_filters, '{}'::jsonb)
  ) < tb.required_events
)
DELETE FROM public.user_badges ub
USING stale_badges stale
WHERE ub.user_id = stale.user_id
  AND ub.badge_id = stale.badge_id;
