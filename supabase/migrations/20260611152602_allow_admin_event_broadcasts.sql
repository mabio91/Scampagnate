-- Allow admins to manage event broadcast history even when they are not the
-- event organizer. The push itself may already be queued before this log row.
ALTER POLICY "Organizers can insert broadcasts for their events"
ON public.event_broadcasts
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events
    WHERE events.id = event_broadcasts.event_id
      AND (
        events.organizer_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

ALTER POLICY "Organizers can view broadcasts for their events"
ON public.event_broadcasts
USING (
  EXISTS (
    SELECT 1
    FROM public.events
    WHERE events.id = event_broadcasts.event_id
      AND (
        events.organizer_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);
