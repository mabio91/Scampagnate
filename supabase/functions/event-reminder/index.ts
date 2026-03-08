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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Promemoria Evento</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'DM Sans','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ec;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(45,74,51,0.08);">
        
        <!-- Header -->
        <tr><td style="background-color:#2d4a33;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#f5f2ec;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:0.5px;">
            Scampagnate
          </h1>
          <p style="margin:6px 0 0;color:rgba(245,242,236,0.7);font-size:13px;letter-spacing:1px;text-transform:uppercase;">
            Eventi &amp; Community
          </p>
        </td></tr>

        <!-- Accent bar -->
        <tr><td style="background:linear-gradient(90deg,#c2854a,#d4943a,#c2854a);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Content -->
        <tr><td style="padding:36px 32px 28px;">
          <h2 style="margin:0 0 6px;color:#1f3d24;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;font-size:21px;font-weight:700;">
            Promemoria: evento domani
          </h2>
          <p style="color:#6b7c6e;font-size:15px;line-height:1.6;margin:12px 0 28px;">
            Ti ricordiamo che domani parteciperai a un evento. Ecco i dettagli:
          </p>

          <!-- Event card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ec;border-radius:12px;border-left:4px solid #c2854a;">
            <tr><td style="padding:20px 24px;">
              <h3 style="margin:0 0 14px;color:#2d4a33;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;font-size:18px;font-weight:700;">
                ${eventTitle}
              </h3>
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td style="padding:4px 0;color:#4a5c4d;font-size:14px;line-height:1.5;vertical-align:top;width:24px;">
                    <span style="color:#c2854a;font-weight:600;">&#9679;</span>
                  </td>
                  <td style="padding:4px 0;color:#4a5c4d;font-size:14px;line-height:1.5;">
                    <strong style="color:#2d4a33;">${eventDate}</strong> alle <strong style="color:#2d4a33;">${eventTime}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#4a5c4d;font-size:14px;line-height:1.5;vertical-align:top;width:24px;">
                    <span style="color:#c2854a;font-weight:600;">&#9679;</span>
                  </td>
                  <td style="padding:4px 0;color:#4a5c4d;font-size:14px;line-height:1.5;">
                    ${eventLocation}
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="color:#6b7c6e;font-size:14px;line-height:1.7;margin:24px 0 0;">
            Controlla l'equipaggiamento e preparati per una bella giornata all'aperto. Ci vediamo domani!
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#f9f7f3;border-top:1px solid #ebe7df;text-align:center;">
          <p style="margin:0;color:#9a9287;font-size:12px;line-height:1.5;">
            Scampagnate &mdash; noreply@scampagnate.techyfux.com
          </p>
          <p style="margin:4px 0 0;color:#b5afa6;font-size:11px;">
            Ricevi questa email perch&eacute; sei iscritto a un evento.
          </p>
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
