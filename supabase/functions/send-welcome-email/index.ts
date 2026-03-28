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

    const { userId, email, firstName, lastName } = await req.json();

    // recipientEmail is an alias supported for DB trigger compatibility
    const recipientEmail = email;

    if (!userId || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if welcome email was already sent to this user (send only once)
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

    // Fetch the active welcome email template from admin-managed table
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true)
      .like('template_key', 'welcome_email%')
      .limit(1)
      .single();

    if (!template) {
      throw new Error('No active welcome email template found in email_templates table');
    }

    // Build template variables
    const name = firstName || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || '';
    const greeting = name ? name : '';
    const ctaUrl = template.cta_url ? `https://scampagnate.com${template.cta_url}` : 'https://scampagnate.com';

    // Replace template variables in body
    let htmlBody = template.body_html
      .replace(/\{\{first_name\}\}/g, greeting)
      .replace(/\{\{full_name\}\}/g, fullName)
      .replace(/\{\{email\}\}/g, recipientEmail)
      .replace(/\{\{cta_url\}\}/g, ctaUrl);

    // Handle greeting fallback: if name is empty, fix "Ciao ," to "Ciao!"
    htmlBody = htmlBody.replace(/Ciao\s*,/g, name ? `Ciao ${name},` : 'Ciao!');

    // Replace subject variables
    const subject = template.subject
      .replace(/\{\{first_name\}\}/g, greeting)
      .replace(/\{\{full_name\}\}/g, fullName);

    // Build plain-text version (anti-spam best practice)
    const plainTextBody = htmlBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Build full HTML email with responsive, clean layout
    const senderName = template.sender_name || 'Scampagnate';
    const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f7f5f0;font-family:'DM Sans',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  ${template.preview_text ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#f7f5f0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${template.preview_text.replace(/\{\{first_name\}\}/g, greeting).replace(/\{\{full_name\}\}/g, fullName)}</div><!--<![endif]-->` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f5f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a3a2a;padding:28px 32px;text-align:center;">
              <h1 style="color:#f0ebe0;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;margin:0;letter-spacing:0.3px;">
                Scampagnate
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 24px;">
              <div style="font-size:15px;line-height:1.7;color:#2d3b30;">
                ${htmlBody}
              </div>
              ${template.cta_label && template.cta_url ? `
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="${ctaUrl}" 
                   style="display:inline-block;background-color:#1a3a2a;color:#f0ebe0;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
                  ${template.cta_label}
                </a>
              </div>` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 24px;background-color:#f0ebe0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#6b7c6e;line-height:1.5;">
                Hai ricevuto questa email perch&eacute; hai creato un account su Scampagnate.
              </p>
              <p style="margin:0;font-size:12px;color:#8a9a8d;">
                &copy; ${new Date().getFullYear()} Scampagnate &middot; Tutti i diritti riservati
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send email via Resend with both HTML and plain-text
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} <noreply@scampagnate.com>`,
        to: [recipientEmail],
        subject,
        html: fullHtml,
        text: plainTextBody,
        reply_to: template.reply_to || 'info@scampagnate.com',
        headers: {
          'X-Entity-Ref-ID': `welcome-${userId}`,
          'List-Unsubscribe': '<mailto:info@scampagnate.com?subject=unsubscribe>',
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Log failed attempt
      await supabase.from('email_send_log').insert({
        user_id: userId,
        email_type: 'welcome',
        recipient_email: recipientEmail,
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
      recipient_email: recipientEmail,
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
