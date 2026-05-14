import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_BUNDLE_ID = "com.fmcp.scampagnate.app";
const PAGE_SIZE = 1000;
const SEND_CONCURRENCY = 12;

type IOSPushEnvironment = "sandbox" | "production";

type IOSPushTarget = {
  user_id: string;
  device_token: string;
};

type UserSendResult = {
  userId: string;
  sent: number;
  failed: number;
  expired: number;
  error?: string | null;
};

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

async function fetchTargets(supabaseAdmin: any, environment: IOSPushEnvironment, bundleId: string) {
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

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
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
  const internalPushSecret = Deno.env.get("SCAMPAGNATE_INTERNAL_PUSH_SECRET") ?? "";
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

    const targets = await fetchTargets(supabaseAdmin, environment, bundleId);
    const uniqueUserIds = Array.from(new Set(targets.map((target) => target.user_id)));

    if (dryRun) {
      return json({
        success: true,
        dry_run: true,
        environment,
        target_count: targets.length,
        unique_user_count: uniqueUserIds.length,
      });
    }

    if (!internalPushSecret) {
      throw new Error("Internal iOS push secret is not configured");
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("ios_push_broadcasts")
      .insert({
        title,
        message,
        environment,
        status: uniqueUserIds.length === 0 ? "completed" : "sending",
        created_by: userId,
        target_count: targets.length,
        unique_user_count: uniqueUserIds.length,
      })
      .select("*")
      .single();

    if (campaignError || !campaign) throw campaignError ?? new Error("Unable to create campaign");

    if (uniqueUserIds.length === 0) {
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
      });
    }

    const senderUrl = `${supabaseUrl}/functions/v1/send-ios-push-notification`;
    const results = await runWithConcurrency(uniqueUserIds, SEND_CONCURRENCY, async (targetUserId) => {
      try {
        const response = await fetch(senderUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader ?? "",
            "Content-Type": "application/json",
            "x-scampagnate-internal-secret": internalPushSecret,
          },
          body: JSON.stringify({
            user_id: targetUserId,
            title,
            message,
            environment,
            type: "admin_broadcast",
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return {
            userId: targetUserId,
            sent: 0,
            failed: 1,
            expired: 0,
            error: payload?.error || response.statusText,
          } satisfies UserSendResult;
        }

        return {
          userId: targetUserId,
          sent: Number(payload.sent ?? 0),
          failed: Number(payload.failed ?? 0),
          expired: Number(payload.expired ?? 0),
          error: null,
        } satisfies UserSendResult;
      } catch (error) {
        return {
          userId: targetUserId,
          sent: 0,
          failed: 1,
          expired: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        } satisfies UserSendResult;
      }
    });

    const sentCount = results.reduce((sum, result) => sum + result.sent, 0);
    const failedCount = results.reduce((sum, result) => sum + result.failed, 0);
    const expiredCount = results.reduce((sum, result) => sum + result.expired, 0);
    const firstError = results.find((result) => result.error)?.error ?? null;
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
      target_count: targets.length,
      unique_user_count: uniqueUserIds.length,
      sent_count: sentCount,
      failed_count: failedCount,
      expired_count: expiredCount,
      error: firstError,
    });
  } catch (error) {
    console.error("send-ios-broadcast error:", error);
    const message = error instanceof Error ? error.message : "Unable to send iOS broadcast";
    return json({ error: message }, 500);
  }
});
