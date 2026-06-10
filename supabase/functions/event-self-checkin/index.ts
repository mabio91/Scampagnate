import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACTIVE_CHECKIN_STATUSES = new Set(["registered", "deposit_paid", "paid", "attended", "no_show"]);
const BLOCKED_EVENT_STATUSES = new Set(["cancelled", "draft", "unpublished", "rescheduled"]);

type CheckInTokenPayload = {
  eventId: string;
  exp: number;
};

type EventRegistrationRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  checked_in: boolean | null;
  user_id: string | null;
  sport_level: string | null;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
};

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const encodePayload = (payload: CheckInTokenPayload) =>
  bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

const decodePayload = (value: string): CheckInTokenPayload => {
  const decoded = new TextDecoder().decode(base64UrlToBytes(value));
  const payload = JSON.parse(decoded);
  if (typeof payload?.eventId !== "string" || typeof payload?.exp !== "number") {
    throw new Error("Malformed token payload");
  }
  return payload;
};

const getSigningSecret = () =>
  Deno.env.get("EVENT_SELF_CHECKIN_SECRET") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

const signPayload = async (payloadPart: string) => {
  const secret = getSigningSecret();
  if (!secret) throw new Error("Missing check-in signing secret");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart));
  return bytesToBase64Url(new Uint8Array(signature));
};

const timingSafeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
};

const createCheckInToken = async (payload: CheckInTokenPayload) => {
  const payloadPart = encodePayload(payload);
  const signaturePart = await signPayload(payloadPart);
  return `v1.${payloadPart}.${signaturePart}`;
};

const verifyCheckInToken = async (token: string, eventId: string) => {
  const [version, payloadPart, signaturePart] = token.split(".");
  if (version !== "v1" || !payloadPart || !signaturePart) {
    throw new Error("INVALID_TOKEN");
  }

  const expectedSignature = await signPayload(payloadPart);
  if (!timingSafeEqual(base64UrlToBytes(signaturePart), base64UrlToBytes(expectedSignature))) {
    throw new Error("INVALID_TOKEN");
  }

  const payload = decodePayload(payloadPart);
  if (payload.eventId !== eventId) throw new Error("INVALID_TOKEN");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("EXPIRED_TOKEN");
  return payload;
};

const toRomeDateString = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const addDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getTokenExpiry = (eventDate: string | null) => {
  if (!eventDate) return Math.floor(Date.now() / 1000) + (48 * 60 * 60);
  return Math.floor(new Date(`${addDays(eventDate, 1)}T23:59:59Z`).getTime() / 1000);
};

const isWithinCheckInWindow = (eventDate: string | null) => {
  if (!eventDate) return true;
  const today = toRomeDateString();
  const lastAllowedDate = addDays(eventDate, 1);
  return today >= eventDate && today <= lastAllowedDate;
};

const getAuthenticatedUser = async (req: Request, supabaseClient: ReturnType<typeof createClient>) => {
  const token = getBearerToken(req);
  if (!token) throw new Error("AUTH_REQUIRED");

  const { data, error } = await supabaseClient.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user;
};

const getEvent = async (supabaseAdmin: ReturnType<typeof createClient>, eventId: string) => {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id,title,date,time,duration,status,organizer_id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("EVENT_NOT_FOUND");
  return data as {
    id: string;
    title: string | null;
    date: string | null;
    time: string | null;
    duration: string | null;
    status: string | null;
    organizer_id: string | null;
  };
};

const hasAdminRole = async (supabaseAdmin: ReturnType<typeof createClient>, userId: string) => {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw error;
  return data === true;
};

const isEventStaff = async (supabaseAdmin: ReturnType<typeof createClient>, eventId: string, userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("event_staff")
    .select("id")
    .eq("event_id", eventId)
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

const assertCanGenerate = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  event: Awaited<ReturnType<typeof getEvent>>,
  userId: string,
) => {
  if (event.organizer_id === userId) return;
  if (await hasAdminRole(supabaseAdmin, userId)) return;
  if (await isEventStaff(supabaseAdmin, event.id, userId)) return;
  throw new Error("FORBIDDEN");
};

const generateCheckInLink = async (
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) => {
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const origin = typeof body.origin === "string" && body.origin.startsWith("http")
    ? body.origin.replace(/\/+$/, "")
    : "https://www.scampagnate.it";
  if (!eventId) return jsonResponse({ success: false, error: "Event ID required" }, 400);

  const user = await getAuthenticatedUser(req, supabaseClient);
  const event = await getEvent(supabaseAdmin, eventId);
  await assertCanGenerate(supabaseAdmin, event, user.id);

  const token = await createCheckInToken({
    eventId,
    exp: getTokenExpiry(event.date),
  });

  return jsonResponse({
    success: true,
    eventId,
    eventTitle: event.title,
    expiresAt: new Date(getTokenExpiry(event.date) * 1000).toISOString(),
    checkInUrl: `${origin}/event/${eventId}/check-in?t=${encodeURIComponent(token)}`,
  });
};

const completeSelfCheckIn = async (
  req: Request,
  supabaseClient: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) => {
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (!eventId || !token) return jsonResponse({ success: false, error: "Event ID and token required" }, 400);

  const user = await getAuthenticatedUser(req, supabaseClient);
  const event = await getEvent(supabaseAdmin, eventId);

  if (event.status && BLOCKED_EVENT_STATUSES.has(event.status)) {
    return jsonResponse({ success: false, error: "EVENT_NOT_CHECKINABLE" }, 400);
  }

  await verifyCheckInToken(token, eventId);
  if (!isWithinCheckInWindow(event.date)) {
    return jsonResponse({ success: false, error: "CHECKIN_WINDOW_CLOSED" }, 400);
  }

  const { data: registrations, error: registrationError } = await supabaseAdmin
    .from("event_registrations")
    .select("id,status,payment_status,checked_in,user_id,sport_level")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (registrationError) throw registrationError;

  const registration = ((registrations || []) as EventRegistrationRow[]).find((row) =>
    ACTIVE_CHECKIN_STATUSES.has(String(row.status || "")) &&
    row.payment_status !== "pending" &&
    !String(row.sport_level || "").startsWith("manual:")
  );

  if (!registration) {
    return jsonResponse({ success: false, error: "REGISTRATION_NOT_FOUND" }, 404);
  }

  if (registration.checked_in || registration.status === "attended") {
    return jsonResponse({
      success: true,
      alreadyCheckedIn: true,
      eventTitle: event.title,
      registrationId: registration.id,
    });
  }

  const { data: updatedRegistration, error: updateError } = await supabaseAdmin
    .from("event_registrations")
    .update({ checked_in: true })
    .eq("id", registration.id)
    .select("id,status,checked_in")
    .single();

  if (updateError) throw updateError;

  return jsonResponse({
    success: true,
    alreadyCheckedIn: false,
    eventTitle: event.title,
    registrationId: updatedRegistration.id,
    status: updatedRegistration.status,
    checkedIn: updatedRegistration.checked_in,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "checkin";

    if (action === "generate") {
      return await generateCheckInLink(req, supabaseClient, supabaseAdmin, body);
    }

    if (action === "checkin") {
      return await completeSelfCheckIn(req, supabaseClient, supabaseAdmin, body);
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "AUTH_REQUIRED" ? 401
      : message === "FORBIDDEN" ? 403
      : message === "EVENT_NOT_FOUND" ? 404
      : message === "INVALID_TOKEN" || message === "EXPIRED_TOKEN" ? 400
      : 500;

    console.error("event-self-checkin error:", error);
    return jsonResponse({ success: false, error: message }, status);
  }
});
