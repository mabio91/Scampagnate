import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("send-email: sends a test email successfully", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      to: "noreply@scampagnate.com",
      subject: "🧪 Test Scampagnate - Email funzionante!",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #16a34a;">✅ Test riuscito!</h2>
          <p>Se stai leggendo questa email, la funzione <strong>send-email</strong> di Scampagnate funziona correttamente con Resend.</p>
          <p style="color: #666; font-size: 14px;">Inviata il: ${new Date().toLocaleString("it-IT")}</p>
        </div>
      `,
    }),
  });

  const body = await response.json();
  console.log("Response status:", response.status);
  console.log("Response body:", JSON.stringify(body));

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
});
