
-- Drop the existing unique constraint that blocks multiple manual entries
ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_event_id_user_id_key;

-- Create a partial unique index that only applies to non-manual entries
CREATE UNIQUE INDEX event_registrations_event_user_unique
  ON public.event_registrations (event_id, user_id)
  WHERE (sport_level IS NULL OR sport_level NOT LIKE 'manual:%');

-- Add RLS policy for organizers to INSERT registrations (for manual participant entry)
CREATE POLICY "Organizers can insert registrations for own events"
  ON public.event_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_registrations.event_id
        AND events.organizer_id = auth.uid()
    )
  );
