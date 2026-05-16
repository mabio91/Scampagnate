import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildReminderEmailHtml(
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  eventLocation: string,
  meetingPointName: string | null,
  meetingPointLocation: string | null,
  meetingPointTime: string | null,
  mapsLink: string,
  reminderType: '24h' | '3h'
): string {
  const headline = reminderType === '24h' ? 'Promemoria: evento domani' : 'Evento tra 3 ore!';
  const subtitle = reminderType === '24h'
    ? 'Ti ricordiamo che domani parteciperai a un evento. Ecco i dettagli:'
    : 'Il tuo evento inizia tra poco! Ecco un riepilogo rapido:';

  const meetingPointHtml = meetingPointName ? `
    <tr>
      <td style="padding:4px 0;color:#4a5c4d;font-size:14px;line-height:1.5;vertical-align:top;width:24px;">
        <span style="color:#c2854a;font-weight:600;">&#9679;</span>
      </td>
      <td style="padding:4px 0;color:#4a5c4d;font-size:14px;line-height:1.5;">
        <strong style="color:#2d4a33;">Punto di ritrovo:</strong> ${meetingPointName}${meetingPointLocation ? ` — ${meetingPointLocation}` : ''}${meetingPointTime ? ` alle ${meetingPointTime}` : ''}
      </td>
    </tr>` : '';

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
            ${headline}
          </h2>
          <p style="color:#6b7c6e;font-size:15px;line-height:1.6;margin:12px 0 28px;">
            ${subtitle}
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
                ${meetingPointHtml}
              </table>
            </td></tr>
          </table>

          <!-- Navigation button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr><td align="center">
              <a href="${mapsLink}" target="_blank" style="display:inline-block;background-color:#2d4a33;color:#f5f2ec;font-family:'DM Sans','Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">
                📍 Apri Navigazione
              </a>
            </td></tr>
          </table>

          <p style="color:#6b7c6e;font-size:14px;line-height:1.7;margin:24px 0 0;">
            ${reminderType === '24h' 
              ? "Controlla l'equipaggiamento e preparati per una bella giornata all'aperto. Ci vediamo domani!" 
              : "Assicurati di avere tutto pronto. A tra poco!"}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background:#f9f7f3;border-top:1px solid #ebe7df;text-align:center;">
          <p style="margin:0;color:#9a9287;font-size:12px;line-height:1.5;">
            Scampagnate &mdash; noreply@scampagnate.com
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

    // Parse reminder_type from request body (default: '24h')
    let reminderType: '24h' | '3h' = '24h';
    try {
      const body = await req.json();
      if (body?.reminder_type === '3h') reminderType = '3h';
    } catch {
      // No body or invalid JSON — default to 24h
    }

    const now = new Date();
    const windowStartMs = reminderType === '24h' ? 24 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
    const windowEndMs = windowStartMs + 60 * 60 * 1000; // 1-hour window

    const windowStart = new Date(now.getTime() + windowStartMs);
    const windowEnd = new Date(now.getTime() + windowEndMs);

    const dateStart = windowStart.toISOString().split('T')[0];
    const dateEnd = windowEnd.toISOString().split('T')[0];

    const datesToQuery = dateStart === dateEnd ? [dateStart] : [dateStart, dateEnd];

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, date, time, location')
      .in('date', datesToQuery)
      .in('status', ['available', 'published', 'open']);

    if (eventsError) throw eventsError;

    if (!events || events.length === 0) {
      console.log(`No events in the ${reminderType} window`);
      return new Response(JSON.stringify({ reminders_sent: 0, reminder_type: reminderType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upcomingEvents = events.filter((event) => {
      const eventDateTime = new Date(`${event.date}T${event.time}`);
      return eventDateTime >= windowStart && eventDateTime < windowEnd;
    });

    if (upcomingEvents.length === 0) {
      console.log(`No events precisely in the ${reminderType} window after time filtering`);
      return new Response(JSON.stringify({ reminders_sent: 0, reminder_type: reminderType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notifType = reminderType === '24h' ? 'event_reminder_24h' : 'event_reminder_3h';

    let totalReminders = 0;
    let totalEmails = 0;

    for (const event of upcomingEvents) {
      // Fetch registrations with meeting points
      const { data: registrationsRaw, error: regError } = await supabase
        .from('event_registrations')
        .select('user_id, meeting_point_id, sport_level')
        .eq('event_id', event.id)
        .in('status', ['registered', 'deposit_paid', 'paid']);

      if (regError) {
        console.error(`Error fetching registrations for event ${event.id}:`, regError);
        continue;
      }

      const registrations = (registrationsRaw || []).filter((registration) =>
        registration.user_id && !String(registration.sport_level || '').startsWith('manual:')
      );

      if (registrations.length === 0) continue;

      // Fetch meeting points for this event
      const { data: meetingPoints } = await supabase
        .from('event_meeting_points')
        .select('id, name, location, time')
        .eq('event_id', event.id);

      const mpMap: Record<string, { name: string; location: string; time: string }> = {};
      if (meetingPoints) {
        for (const mp of meetingPoints) {
          mpMap[mp.id] = { name: mp.name, location: mp.location, time: mp.time };
        }
      }

      const userIds = registrations.map((r) => r.user_id);

      // Check for existing reminders of this type to avoid duplicates
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('type', notifType)
        .in('user_id', userIds);

      const alreadyNotified = new Set((existingNotifs || []).map((n) => n.user_id));
      const regsToNotify = registrations.filter((r) => !alreadyNotified.has(r.user_id));

      if (regsToNotify.length === 0) continue;

      const formattedDate = new Date(event.date).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;

      // Create in-app reminder notifications with meeting point details
      const notifications = regsToNotify.map((reg) => {
        const mp = reg.meeting_point_id ? mpMap[reg.meeting_point_id] : null;
        const mpText = mp ? `\n📍 Punto di ritrovo: ${mp.name} (${mp.location}) alle ${mp.time}` : '';
        const timeLabel = reminderType === '24h' ? 'domani' : 'tra 3 ore';

        return {
          user_id: reg.user_id,
          type: notifType,
          title: reminderType === '24h' ? `⏰ Evento ${timeLabel}!` : `🚀 Evento ${timeLabel}!`,
          message: `"${event.title}" è ${timeLabel} alle ${event.time} a ${event.location}.${mpText}\n🗺️ Apri navigazione: ${mapsLink}`,
          event_id: event.id,
          read: false,
        };
      });

      const { error: insertError } = await supabase.from('notifications').insert(notifications);

      if (insertError) {
        console.error(`Error inserting ${reminderType} reminders for event ${event.id}:`, insertError);
        continue;
      }

      totalReminders += regsToNotify.length;

      // Send reminder emails
      for (const reg of regsToNotify) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(reg.user_id);
          if (userError || !userData?.user?.email) continue;

          const mp = reg.meeting_point_id ? mpMap[reg.meeting_point_id] : null;

          const emailHtml = buildReminderEmailHtml(
            event.title,
            formattedDate,
            event.time,
            event.location,
            mp?.name || null,
            mp?.location || null,
            mp?.time || null,
            mapsLink,
            reminderType
          );

          const subjectPrefix = reminderType === '24h' ? 'Domani' : 'Tra 3 ore';

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              to: userData.user.email,
              subject: `${subjectPrefix}: "${event.title}"!`,
              html: emailHtml,
            }),
          });

          if (emailRes.ok) {
            totalEmails++;
          } else {
            const errBody = await emailRes.text();
            console.error(`Email send failed for ${reg.user_id}:`, errBody);
          }
        } catch (emailErr) {
          console.error(`Email error for user ${reg.user_id}:`, emailErr);
        }
      }

      console.log(`Sent ${regsToNotify.length} ${reminderType} reminders for event "${event.title}"`);
    }

    console.log(`Total ${reminderType}: ${totalReminders} reminders, ${totalEmails} emails sent`);
    return new Response(
      JSON.stringify({ reminders_sent: totalReminders, emails_sent: totalEmails, events_processed: upcomingEvents.length, reminder_type: reminderType }),
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
