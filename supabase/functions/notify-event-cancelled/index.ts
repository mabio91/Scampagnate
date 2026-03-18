import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildCancellationEmailHtml(eventTitle: string, eventDate: string, eventTime: string, eventLocation: string): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 24px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px">❌</div>
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700">Evento Cancellato</h1>
  </td></tr>
  <tr><td style="padding:28px 24px">
    <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.5">
      Ci dispiace informarti che il seguente evento è stato <strong>cancellato</strong>:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;padding:16px;margin-bottom:20px">
      <tr><td>
        <h2 style="font-size:18px;color:#1f2937;margin:0 0 12px;font-weight:700">${eventTitle}</h2>
        <p style="font-size:14px;color:#4b5563;margin:0 0 6px">📅 ${eventDate}</p>
        <p style="font-size:14px;color:#4b5563;margin:0 0 6px">⏰ ${eventTime}</p>
        <p style="font-size:14px;color:#4b5563;margin:0">📍 ${eventLocation}</p>
      </td></tr>
    </table>
    <p style="font-size:14px;color:#6b7280;margin:0;line-height:1.5">
      Se avevi effettuato un pagamento, verrai contattato per il rimborso. Per qualsiasi domanda, contatta l'organizzatore.
    </p>
  </td></tr>
  <tr><td style="padding:0 24px 24px;text-align:center">
    <a href="https://scampagnate.com" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
      Scopri altri eventi
    </a>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
    <p style="font-size:12px;color:#9ca3af;margin:0">Gruppo Scampagnate · Notifica automatica</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: 'event_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, date, time, location')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active registrations
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('user_id')
      .eq('event_id', event_id)
      .in('status', ['registered', 'paid', 'waitlist', 'pending_approval']);

    if (!registrations || registrations.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = [...new Set(registrations.map(r => r.user_id))];

    // Create in-app notifications for all participants
    const notifications = userIds.map(uid => ({
      user_id: uid,
      type: 'event_cancelled',
      title: '❌ Evento cancellato',
      message: `L'evento "${event.title}" previsto per il ${event.date} alle ${event.time} è stato cancellato.`,
      event_id,
    }));

    const { error: notifError } = await supabase.from('notifications').insert(notifications);
    if (notifError) console.error('Notification insert error:', notifError);

    // Fetch participant emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', userIds);

    const emails = profiles?.map(p => p.email).filter(Boolean) || [];

    // Send cancellation emails
    const emailHtml = buildCancellationEmailHtml(
      event.title,
      event.date,
      event.time,
      event.location
    );

    let emailsSent = 0;
    for (const email of emails) {
      try {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        if (!RESEND_API_KEY) break;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Scampagnate <noreply@scampagnate.com>',
            to: [email],
            subject: `❌ Evento cancellato: ${event.title}`,
            html: emailHtml,
          }),
        });
        emailsSent++;
      } catch (e) {
        console.error(`Email send error for ${email}:`, e);
      }
    }

    // Also cancel all active registrations
    await supabase
      .from('event_registrations')
      .update({ status: 'cancelled' as any })
      .eq('event_id', event_id)
      .in('status', ['registered', 'paid', 'waitlist', 'pending_approval']);

    console.log(`Event ${event.title} cancelled: ${userIds.length} notified, ${emailsSent} emails sent`);

    return new Response(JSON.stringify({ 
      success: true, 
      notified: userIds.length, 
      emails_sent: emailsSent 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Cancellation notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
