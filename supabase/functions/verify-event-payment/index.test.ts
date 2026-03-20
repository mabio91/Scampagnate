import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("verify-event-payment rejects missing sessionId", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-event-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({}),
  });

  const body = await response.text();
  console.log("No sessionId response:", response.status, body);
  // Should fail because no valid user token
  assertEquals(response.status >= 400, true);
});

Deno.test("verify-event-payment rejects invalid session", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-event-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ sessionId: "cs_test_fake_session_id" }),
  });

  const body = await response.text();
  console.log("Invalid session response:", response.status, body);
  assertEquals(response.status >= 400, true);
});
