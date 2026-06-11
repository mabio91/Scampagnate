import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_BUNDLE_ID = "com.fmcp.scampagnate.app";
const PAGE_SIZE = 1000;

type IOSPushEnvironment = "sandbox" | "production";

type IOSPushTarget = {
  user_id: string;
  device_token: string;
};

type OneSignalTarget = {
  user_id: string;
  player_id: string;
};

type SupabaseAdminClient = ReturnType<typeof createClient>;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokenFromAuthHeader(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function userIdFromVerifiedJwt(authHeader: string | null) {
  const token = tokenFromAuthHeader(authHeader);
  if (!token) return null;

  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const claims = JSON.parse(decodeBase64Url(payload));
    return typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
  } catch (_error) {
    return null;
  }
}

async function fetchIOSTargets(
  supabaseAdmin: SupabaseAdminClient,
  environment: IOSPushEnvironment,
  bundleId: string,
) {
  const targets: IOSPushTarget[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("ios_device_tokens")
      .select("user_id,device_token")
      .eq("enabled", true)
      .eq("environment", environment)
      .eq("bundle_id", bundleId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as IOSPushTarget[];
    targets.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return targets.filter((target) => target.user_id && target.device_token);
}

async function fetchOneSignalTargets(supabaseAdmin: SupabaseAdminClient) {
  const targets: OneSignalTarget[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("onesignal_players")
      .select("user_id,player_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as OneSignalTarget[];
    targets.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return targets.filter((target) => target.user_id && target.player_id);
}

function uniqueUserIds(targets: Array<{ user_id: string }>) {
  return Array.from(new Set(targets.map((target) => target.user_id)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") || DEFAULT_BUNDLE_ID;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    const userId = userIdFromVerifiedJwt(authHeader);
    if (!userId) {
      console.warn("send-ios-broadcast missing authenticated JWT", {
        hasAuthorizationHeader: Boolean(authHeader),
        tokenLooksLikeJwt: Boolean(tokenFromAuthHeader(authHeader)?.includes(".")),
      });
      return json({ error: "User not authenticated" }, 401);
    }

    const { data: role, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) throw roleError;
    if (!role) return json({ error: "Admin role required" }, 403);

    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    const environment: IOSPushEnvironment = "production";
    const dryRun = body.dry_run === true;

    if (!title || !message) return json({ error: "Title and message are required" }, 400);
    if (title.length > 120) return json({ error: "Title must be 120 characters or less" }, 400);
    if (message.length > 800) return json({ error: "Message must be 800 characters or less" }, 400);

    const iosTargets = await fetchIOSTargets(supabaseAdmin, environment, bundleId);
    const oneSignalTargets = await fetchOneSignalTargets(supabaseAdmin);
    const iosUserIds = uniqueUserIds(iosTargets);
    const oneSignalUserIds = uniqueUserIds(oneSignalTargets);
    const broadcastUserIds = Array.from(new Set([...iosUserIds, ...oneSignalUserIds]));
    const targetCount = iosTargets.length + oneSignalTargets.length;

    if (dryRun) {
      return json({
        success: true,
        dry_run: true,
        environment,
        target_count: targetCount,
        unique_user_count: broadcastUserIds.length,
        ios_target_count: iosTargets.length,
        ios_user_count: iosUserIds.length,
        onesignal_target_count: oneSignalTargets.length,
        onesignal_user_count: oneSignalUserIds.length,
      });
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("ios_push_broadcasts")
      .insert({
        title,
        message,
        environment,
        status: broadcastUserIds.length === 0 ? "completed" : "sending",
        created_by: userId,
        target_count: targetCount,
        unique_user_count: broadcastUserIds.length,
      })
      .select("*")
      .single();

    if (campaignError || !campaign) throw campaignError ?? new Error("Unable to create campaign");

    if (broadcastUserIds.length === 0) {
      const now = new Date().toISOString();
      const { data: completedCampaign } = await supabaseAdmin
        .from("ios_push_broadcasts")
        .update({ status: "completed", completed_at: now, updated_at: now })
        .eq("id", campaign.id)
        .select("*")
        .single();

      return json({
        success: true,
        campaign: completedCampaign ?? campaign,
        target_count: 0,
        unique_user_count: 0,
        sent_count: 0,
        failed_count: 0,
        expired_count: 0,
        ios_target_count: iosTargets.length,
        ios_user_count: iosUserIds.length,
        onesignal_target_count: oneSignalTargets.length,
        onesignal_user_count: oneSignalUserIds.length,
      });
    }

    const notificationRows = broadcastUserIds.map((targetUserId) => ({
      user_id: targetUserId,
      type: "admin_broadcast",
      title,
      message,
      event_id: null,
      read: false,
    }));

    const { data: savedNotifications, error: notificationError } = await supabaseAdmin
      .from("notifications")
      .insert(notificationRows)
      .select("id, user_id");

    if (notificationError) throw notificationError;

    const sentCount = savedNotifications?.length ?? 0;
    const failedCount = Math.max(broadcastUserIds.length - sentCount, 0);
    const expiredCount = 0;
    const firstError = failedCount > 0
      ? `Unable to queue ${failedCount} push notification${failedCount === 1 ? "" : "s"}`
      : null;
    const status = failedCount === 0
      ? "completed"
      : sentCount > 0
        ? "partial_failed"
        : "failed";

    const now = new Date().toISOString();
    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from("ios_push_broadcasts")
      .update({
        status,
        sent_count: sentCount,
        failed_count: failedCount,
        expired_count: expiredCount,
        error_message: firstError,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", campaign.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return json({
      success: status !== "failed",
      campaign: updatedCampaign,
      target_count: targetCount,
      unique_user_count: broadcastUserIds.length,
      sent_count: sentCount,
      failed_count: failedCount,
      expired_count: expiredCount,
      error: firstError,
      ios_target_count: iosTargets.length,
      ios_user_count: iosUserIds.length,
      onesignal_target_count: oneSignalTargets.length,
      onesignal_user_count: oneSignalUserIds.length,
    });
  } catch (error) {
    console.error("send-ios-broadcast error:", error);
    const message = error instanceof Error ? error.message : "Unable to send push broadcast";
    return json({ error: message }, 500);
  }
});
