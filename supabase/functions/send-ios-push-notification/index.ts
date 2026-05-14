import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scampagnate-internal-secret",
};

type PushRequest = {
  user_id?: string;
  notification_id?: string;
  title?: string;
  message?: string;
  event_id?: string | null;
  type?: string | null;
  environment?: "sandbox" | "production" | null;
};

type IOSDeviceToken = {
  id: string;
  device_token: string;
  environment: "sandbox" | "production";
  bundle_id: string;
};

let cachedJwt: { token: string; issuedAt: number } | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const base64Url = (input: string | Uint8Array) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const pemToArrayBuffer = (pem: string) => {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const createAPNsJWT = async () => {
  const teamId = Deno.env.get("APNS_TEAM_ID") ?? "";
  const keyId = Deno.env.get("APNS_KEY_ID") ?? "";
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY") ?? "";

  if (!teamId || !keyId || !privateKey) {
    throw new Error("APNs credentials are not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) return cachedJwt.token;

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${claims}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      new TextEncoder().encode(signingInput),
    ),
  );

  const token = `${signingInput}.${base64Url(signature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
};

const apnsHost = (environment: IOSDeviceToken["environment"]) =>
  environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";

const shouldDeleteToken = (status: number, reason?: string) => {
  if (status === 410) return true;
  return ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(reason ?? "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const internalSecret = Deno.env.get("SCAMPAGNATE_INTERNAL_PUSH_SECRET") ?? "";
  if (!internalSecret || req.headers.get("x-scampagnate-internal-secret") !== internalSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { user_id, notification_id, title, message, event_id, type, environment }: PushRequest = await req.json();
    if (!user_id || !title) return json({ error: "Missing user_id or title" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "com.fmcp.scampagnate.app";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase env is not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let tokenQuery = supabase
      .from("ios_device_tokens")
      .select("id, device_token, environment, bundle_id")
      .eq("user_id", user_id)
      .eq("enabled", true)
      .eq("bundle_id", bundleId);

    if (environment === "sandbox" || environment === "production") {
      tokenQuery = tokenQuery.eq("environment", environment);
    }

    const { data: tokens, error } = await tokenQuery;

    if (error) throw error;

    if (!tokens?.length) {
      return json({ sent: 0, failed: 0, expired: 0, message: "No iOS device tokens found" });
    }

    const jwt = await createAPNsJWT();

    const payload = {
      aps: {
        alert: {
          title: title || "Scampagnate",
          body: message || "",
        },
        sound: "default",
      },
      notification_id: notification_id ?? null,
      event_id: event_id ?? null,
      type: type ?? "info",
    };

    const results = await Promise.all(
      (tokens as IOSDeviceToken[]).map(async (token) => {
        const response = await fetch(`https://${apnsHost(token.environment)}/3/device/${token.device_token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${jwt}`,
            "apns-topic": token.bundle_id,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) return { token, ok: true, status: response.status, reason: null };

        let reason: string | undefined;
        try {
          reason = (await response.json())?.reason;
        } catch {
          reason = response.statusText;
        }

        return { token, ok: false, status: response.status, reason };
      }),
    );

    const expiredIds = results
      .filter((result) => !result.ok && shouldDeleteToken(result.status, result.reason ?? undefined))
      .map((result) => result.token.id);

    if (expiredIds.length > 0) {
      await supabase.from("ios_device_tokens").delete().in("id", expiredIds);
    }

    const sent = results.filter((result) => result.ok).length;
    const failed = results.length - sent;

    return json({ sent, failed, expired: expiredIds.length });
  } catch (error) {
    console.error("iOS push notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
