update public.events
set additional_fields = coalesce(additional_fields, '{}'::jsonb) || jsonb_build_object(
  'closing_sentence',
  (
    array[
      '✨ Porta leggerezza, al resto pensiamo noi',
      '✨ Una community che arriva per i sentieri… e resta per le persone',
      '✨ Il difficile è venire. Poi non vorrai più andare via',
      '✨ Fidati: sarà una di quelle giornate che ricordi',
      '✨ Vieni con lo spirito giusto — il resto viene da sé',
      '✨ Qui si conoscono persone, non solo posti'
    ]
  )[
    1 + (abs(hashtext(id::text)) % 6)
  ]
)
where coalesce(additional_fields, '{}'::jsonb) ? 'closing_sentence' = false;
