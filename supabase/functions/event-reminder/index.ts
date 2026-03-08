import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find events happening in the next 24-25 hours (1-hour window to avoid duplicates with hourly cron)
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const tomorrow24 = in24h.toISOString().split('T')[0];
    const tomorrow25 = in25h.toISOString().split('T')[0];

    // Get events happening tomorrow (within the 24-25h window)
    // We check by date and filter by time in code for precision
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, date, time, location')
      .in('date', [tomorrow24, tomorrow25])
      .eq('status', 'available');

    if (eventsError) throw eventsError;

    if (!events || events.length === 0) {
      console.log('No events in the 24-25h window');
      return new Response(JSON.stringify({ reminders_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter events precisely within the 24-25h window
    const upcomingEvents = events.filter((event) => {
      const eventDateTime = new Date(`${event.date}T${event.time}`);
      return eventDateTime >= in24h && eventDateTime < in25h;
    });

    if (upcomingEvents.length === 0) {
      console.log('No events precisely in the 24-25h window after time filtering');
      return new Response(JSON.stringify({ reminders_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalReminders = 0;

    for (const event of upcomingEvents) {
      // Get registered users for this event
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('user_id')
        .eq('event_id', event.id)
        .in('status', ['registered', 'paid']);

      if (regError) {
        console.error(`Error fetching registrations for event ${event.id}:`, regError);
        continue;
      }

      if (!registrations || registrations.length === 0) continue;

      // Check which users already received a reminder for this event (avoid duplicates)
      const userIds = registrations.map((r) => r.user_id);
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('type', 'event_reminder')
        .in('user_id', userIds);

      const alreadyNotified = new Set((existingNotifs || []).map((n) => n.user_id));
      const usersToNotify = userIds.filter((uid) => !alreadyNotified.has(uid));

      if (usersToNotify.length === 0) continue;

      // Create reminder notifications
      const notifications = usersToNotify.map((userId) => ({
        user_id: userId,
        type: 'event_reminder',
        title: 'Promemoria evento domani!',
        message: `"${event.title}" è domani alle ${event.time} a ${event.location}. Non dimenticarti!`,
        event_id: event.id,
        read: false,
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error(`Error inserting reminders for event ${event.id}:`, insertError);
        continue;
      }

      totalReminders += usersToNotify.length;
      console.log(`Sent ${usersToNotify.length} reminders for event "${event.title}"`);
    }

    console.log(`Total reminders sent: ${totalReminders}`);
    return new Response(JSON.stringify({ reminders_sent: totalReminders, events_processed: upcomingEvents.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Event reminder error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
