update public.events
set additional_fields = jsonb_set(
  coalesce(additional_fields, '{}'::jsonb),
  '{closing_sentence}',
  to_jsonb(
    btrim(
      regexp_replace(
        additional_fields ->> 'closing_sentence',
        '^(' || U&'\2728' || '\s*)+',
        ''
      )
    )
  )
)
where coalesce(additional_fields, '{}'::jsonb) ? 'closing_sentence'
  and jsonb_typeof(coalesce(additional_fields, '{}'::jsonb) -> 'closing_sentence') = 'string'
  and additional_fields ->> 'closing_sentence' ~ ('^\s*' || U&'\2728');
