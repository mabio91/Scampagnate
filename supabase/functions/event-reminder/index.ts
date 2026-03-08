import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildReminderEmailHtml(eventTitle: string, eventDate: string, eventTime: string, eventLocation: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f5f0;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background-color:#2d4a33;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;">🏔️ Scampagnate</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;">Promemoria: evento domani!</h2>
          <p style="color:#666;font-size:15px;line-height:1.6;margin:16px 0 24px;">
            Ti ricordiamo che domani parteciperai a:
          </p>
          <table width="100%" style="background:#f7f5f0;border-radius:12px;padding:20px;" cellpadding="0" cellspacing="0">
            <tr><td style="padding:12px 20px;">
              <h3 style="margin:0 0 12px;color:#2d4a33;font-size:18px;">${eventTitle}</h3>
              <p style="margin:4px 0;color:#444;font-size:14px;">📅 <strong>${eventDate}</strong> alle <strong>${eventTime}</strong></p>
              <p style="margin:4px 0;color:#444;font-size:14px;">📍 ${eventLocation}</p>
            </td></tr>
          </table>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:24px 0 0;">
            Non dimenticarti! Controlla l'equipaggiamento e preparati per una bella giornata. 🎒
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9f9f9;text-align:center;">
          <p style="margin:0;color:#999;font-size:12px;">Scampagnate – Eventi & Community</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find events happening in the next 24-25 hours
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const tomorrow24 = in24h.toISOString().split('T')[0];
    const tomorrow25 = in25h.toISOString().split('T')[0];

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
    let totalEmails = 0;

    for (const event of upcomingEvents) {
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

      const userIds = registrations.map((r) => r.user_id);

      // Check for existing reminders to avoid duplicates
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('type', 'event_reminder')
        .in('user_id', userIds);

      const alreadyNotified = new Set((existingNotifs || []).map((n) => n.user_id));
      const usersToNotify = userIds.filter((uid) => !alreadyNotified.has(uid));

      if (usersToNotify.length === 0) continue;

      // Create in-app reminder notifications
      const notifications = usersToNotify.map((userId) => ({
        user_id: userId,
        type: 'event_reminder',
        title: 'Promemoria evento domani!',
        message: `"${event.title}" è domani alle ${event.time} a ${event.location}. Non dimenticarti!`,
        event_id: event.id,
        read: false,
      }));

      const { error: insertError } = await supabase.from('notifications').insert(notifications);

      if (insertError) {
        console.error(`Error inserting reminders for event ${event.id}:`, insertError);
        continue;
      }

      totalReminders += usersToNotify.length;

      // Send reminder emails to users with email addresses
      // Fetch user emails from auth (via service role)
      for (const userId of usersToNotify) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
          if (userError || !userData?.user?.email) continue;

          const formattedDate = new Date(event.date).toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

          const emailHtml = buildReminderEmailHtml(
            event.title,
            formattedDate,
            event.time,
            event.location
          );

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              to: userData.user.email,
              subject: `Promemoria: "${event.title}" è domani!`,
              html: emailHtml,
            }),
          });

          if (emailRes.ok) {
            totalEmails++;
          } else {
            const errBody = await emailRes.text();
            console.error(`Email send failed for ${userId}:`, errBody);
          }
        } catch (emailErr) {
          console.error(`Email error for user ${userId}:`, emailErr);
        }
      }

      console.log(`Sent ${usersToNotify.length} reminders and emails for event "${event.title}"`);
    }

    console.log(`Total: ${totalReminders} reminders, ${totalEmails} emails sent`);
    return new Response(
      JSON.stringify({ reminders_sent: totalReminders, emails_sent: totalEmails, events_processed: upcomingEvents.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Event reminder error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
