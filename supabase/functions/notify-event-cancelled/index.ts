import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordUserPaymentTransaction } from "../_shared/user-payment-transactions.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function buildCancellationEmailHtml(eventTitle: string, eventDate: string, eventTime: string, eventLocation: string) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px 24px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px">X</div>
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700">Evento annullato</h1>
  </td></tr>
  <tr><td style="padding:28px 24px">
    <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.5">
      Ci dispiace informarti che il seguente evento è stato <strong>annullato</strong>:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;padding:16px;margin-bottom:20px">
      <tr><td>
        <h2 style="font-size:18px;color:#1f2937;margin:0 0 12px;font-weight:700">${eventTitle}</h2>
        <p style="font-size:14px;color:#4b5563;margin:0 0 6px">Data: ${eventDate}</p>
        <p style="font-size:14px;color:#4b5563;margin:0 0 6px">Ora: ${eventTime}</p>
        <p style="font-size:14px;color:#4b5563;margin:0">Luogo: ${eventLocation}</p>
      </td></tr>
    </table>
    <p style="font-size:14px;color:#6b7280;margin:0;line-height:1.5">
      Evento annullato. Riceverai il rimborso completo dell'importo versato.
    </p>
  </td></tr>
  <tr><td style="padding:0 24px 24px;text-align:center">
    <a href="https://scampagnate.com" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">
      Scopri altri eventi
    </a>
  </td></tr>
  <tr><td style="border-top:1px solid #e5e7eb;padding:16px 24px;text-align:center">
    <p style="font-size:12px;color:#9ca3af;margin:0">Gruppo Scampagnate - Notifica automatica</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl ?? "", supabaseServiceKey ?? "");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil"
    });
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({
        error: "event_id required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { data: event, error: eventError } = await supabase.from("events").select("title, date, time, location").eq("id", event_id).single();
    if (eventError || !event) {
      return new Response(JSON.stringify({
        error: "Event not found"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { data: registrations } = await supabase.from("event_registrations").select("id, user_id, payment_status, stripe_payment_intent_id, amount_paid, sport_level").eq("event_id", event_id).in("status", [
      "registered",
      "deposit_paid",
      "paid",
      "waitlist",
      "pending_approval",
      "attended",
      "no_show"
    ]);
    if (!registrations || registrations.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        notified: 0,
        refunded: 0
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    let refundedCount = 0;
    for (const registration of registrations){
      const amountPaid = Number(registration.amount_paid || 0);
      const shouldRefund = [
        "paid",
        "deposit_paid"
      ].includes(registration.payment_status || "") && registration.stripe_payment_intent_id && amountPaid > 0;
      if (shouldRefund) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: registration.stripe_payment_intent_id,
            amount: Math.round(amountPaid * 100)
          });
          if (registration.user_id) {
            await recordUserPaymentTransaction(supabase, {
              user_id: registration.user_id,
              registration_id: registration.id,
              event_id: event_id,
              kind: "refund",
              source: "event_cancelled_refund",
              amount: amountPaid,
              event_amount: amountPaid,
              stripe_payment_intent_id: registration.stripe_payment_intent_id,
              stripe_refund_id: refund.id,
              metadata: {
                reason: "event_cancelled",
              },
            });
          }
          await supabase.from("event_registrations").update({
            payment_status: "refunded",
            refund_percentage: 100,
            refund_amount: amountPaid,
            refund_status: "completed",
            cancelled_at: new Date().toISOString(),
            status: "cancelled"
          }).eq("id", registration.id);
          refundedCount += 1;
        } catch (refundError) {
          console.error(`Refund failed for registration ${registration.id}:`, refundError);
          await supabase.from("event_registrations").update({
            refund_percentage: 100,
            refund_amount: amountPaid,
            refund_status: "failed",
            cancelled_at: new Date().toISOString(),
            status: "cancelled"
          }).eq("id", registration.id);
        }
      } else {
        await supabase.from("event_registrations").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          refund_status: amountPaid > 0 ? "not_required" : "not_applicable"
        }).eq("id", registration.id);
      }
    }
    const userIds = [
      ...new Set(registrations.filter((r)=>r.user_id && !String(r.sport_level || "").startsWith("manual:")).map((r)=>r.user_id))
    ];
    const notifications = userIds.map((uid)=>({
        user_id: uid,
        type: "event_cancelled",
        title: "Evento annullato",
        message: "Evento annullato. Riceverai il rimborso completo dell'importo versato.",
        event_id
      }));
    const { error: notifError } = await supabase.from("notifications").insert(notifications);
    if (notifError) console.error("Notification insert error:", notifError);
    const { data: profiles } = await supabase.from("profiles").select("email").in("id", userIds);
    const emails = profiles?.map((p)=>p.email).filter(Boolean) || [];
    const emailHtml = buildCancellationEmailHtml(event.title, event.date, event.time, event.location);
    let emailsSent = 0;
    for (const email of emails){
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) break;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Scampagnate <noreply@scampagnate.com>",
            to: [
              email
            ],
            subject: `Evento annullato: ${event.title}`,
            html: emailHtml
          })
        });
        emailsSent += 1;
      } catch (e) {
        console.error(`Email send error for ${email}:`, e);
      }
    }
    console.log(`Event ${event.title} cancelled: ${userIds.length} notified, ${emailsSent} emails sent, ${refundedCount} refunds completed`);
    return new Response(JSON.stringify({
      success: true,
      notified: userIds.length,
      emails_sent: emailsSent,
      refunded: refundedCount
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Cancellation notification error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unable to cancel event"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
