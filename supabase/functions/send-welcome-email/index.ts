import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { userId, email, firstName } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if welcome email was already sent to this user
    const { data: existingLog } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('user_id', userId)
      .eq('email_type', 'welcome')
      .eq('status', 'sent')
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Welcome email already sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the active welcome email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .like('template_key', 'welcome_email%')
      .limit(1)
      .single();

    if (!template) {
      throw new Error('No active welcome email template found');
    }

    // Replace template variables
    const name = firstName || 'Utente';
    let htmlBody = template.body_html
      .replace(/\{\{first_name\}\}/g, name)
      .replace(/\{\{email\}\}/g, email);

    // Build full HTML email with styling
    const fullHtml = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f5f0;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f5f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a3a2a;padding:32px 40px;text-align:center;">
              <h1 style="color:#f0ebe0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:24px;font-weight:700;margin:0;">
                🌿 Scampagnate
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${template.preview_text ? `<!--[if !mso]><!--><div style="display:none;max-height:0;overflow:hidden;">${template.preview_text}</div><!--<![endif]-->` : ''}
              <div style="font-size:15px;line-height:1.7;color:#2d3b30;">
                ${htmlBody}
              </div>
              ${template.cta_label && template.cta_url ? `
              <div style="text-align:center;margin:32px 0 16px;">
                <a href="https://scampagnate.com${template.cta_url}" 
                   style="display:inline-block;background-color:#1a3a2a;color:#f0ebe0;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                  ${template.cta_label}
                </a>
              </div>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f0ebe0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b7c6e;">
                © ${new Date().getFullYear()} Scampagnate · Tutti i diritti riservati
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${template.sender_name || 'Scampagnate'} <noreply@scampagnate.com>`,
        to: [email],
        subject: template.subject.replace(/\{\{first_name\}\}/g, name),
        html: fullHtml,
        reply_to: template.reply_to || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Log failed attempt
      await supabase.from('email_send_log').insert({
        user_id: userId,
        email_type: 'welcome',
        recipient_email: email,
        status: 'failed',
        template_id: template.id,
        provider_response: JSON.stringify(data),
      });
      throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(data)}`);
    }

    // Log successful send
    await supabase.from('email_send_log').insert({
      user_id: userId,
      email_type: 'welcome',
      recipient_email: email,
      status: 'sent',
      template_id: template.id,
      provider_response: JSON.stringify(data),
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-welcome-email error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
