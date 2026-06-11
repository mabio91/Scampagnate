import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APP_BASE_URL = 'https://scampagnate.com';
const NOTIFICATION_ICON_URL = `${APP_BASE_URL}/apple-touch-icon.png`;
const NOTIFICATION_BADGE_URL = `${APP_BASE_URL}/favicon.png`;
const ONESIGNAL_NOTIFICATIONS_URL = 'https://api.onesignal.com/notifications';

type OneSignalResponse = {
  id?: string;
  recipients?: number;
  external_id?: string;
  errors?: unknown;
  warnings?: unknown;
};

type OneSignalPayload = {
  app_id: string;
  headings: { en: string };
  contents: { en: string };
  url: string;
  web_push_type: 'Notification';
  chrome_web_icon: string;
  chrome_web_badge: string;
  firefox_icon: string;
  safari_icon: string;
  data: {
    type: string;
    event_id: string | null;
    notification_id: string | null;
  };
  include_aliases?: { external_id: string[] };
  include_subscription_ids?: string[];
  target_channel?: 'push';
};

function buildNotificationPath(event_id?: string, notification_id?: string) {
  if (!event_id) return '/';

  const query = notification_id ? `?notification_id=${encodeURIComponent(notification_id)}` : '';
  return `/event/${event_id}${query}`;
}

function recipientCount(result: OneSignalResponse) {
  return typeof result.recipients === 'number' ? result.recipients : null;
}

async function sendOneSignalNotification(apiKey: string, payload: OneSignalPayload) {
  const response = await fetch(ONESIGNAL_NOTIFICATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  let result: OneSignalResponse = {};

  try {
    result = body ? JSON.parse(body) : {};
  } catch {
    result = { errors: { invalid_json_response: body } };
  }

  if (!response.ok) {
    console.error('OneSignal API error:', response.status, JSON.stringify(result));
    throw new Error(`OneSignal API error ${response.status}`);
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, notification_id, title, message, event_id, type } = await req.json();

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'Missing user_id or title' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const onesignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
    const onesignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!onesignalAppId || !onesignalApiKey) {
      console.error('OneSignal keys not configured');
      return new Response(JSON.stringify({ error: 'OneSignal keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Keep stored subscription IDs available as a fallback for older records.
    const { data: players, error } = await supabase
      .from('onesignal_players')
      .select('player_id')
      .eq('user_id', user_id);

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }

    const subscriptionIds = Array.from(new Set((players || [])
      .map((p: { player_id?: string }) => p.player_id)
      .filter((playerId): playerId is string => Boolean(playerId))));

    const notificationPath = buildNotificationPath(event_id, notification_id);
    const basePayload = {
      app_id: onesignalAppId,
      headings: { en: title },
      contents: { en: message || '' },
      url: `${APP_BASE_URL}${notificationPath}`,
      web_push_type: 'Notification' as const,
      chrome_web_icon: NOTIFICATION_ICON_URL,
      chrome_web_badge: NOTIFICATION_BADGE_URL,
      firefox_icon: NOTIFICATION_ICON_URL,
      safari_icon: NOTIFICATION_ICON_URL,
      data: { type: type || 'info', event_id: event_id || null, notification_id: notification_id || null },
    };

    const aliasResult = await sendOneSignalNotification(onesignalApiKey, {
      ...basePayload,
      include_aliases: { external_id: [user_id] },
      target_channel: 'push',
    });

    console.log('OneSignal response (alias):', JSON.stringify({
      id: aliasResult.id,
      recipients: aliasResult.recipients,
      warnings: aliasResult.warnings,
      errors: aliasResult.errors,
      subscription_count: subscriptionIds.length,
    }));

    if (aliasResult.id && !aliasResult.errors) {
      return new Response(JSON.stringify({
        sent: recipientCount(aliasResult),
        accepted: true,
        method: 'alias',
        onesignal_id: aliasResult.id,
        subscription_count: subscriptionIds.length,
        warnings: aliasResult.warnings || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (subscriptionIds.length === 0) {
      return new Response(JSON.stringify({
        sent: 0,
        accepted: false,
        method: 'alias',
        onesignal_id: aliasResult.id || null,
        errors: aliasResult.errors || null,
        warnings: aliasResult.warnings || null,
        subscription_count: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionResult = await sendOneSignalNotification(onesignalApiKey, {
      ...basePayload,
      include_subscription_ids: subscriptionIds,
    });

    console.log('OneSignal response (subscription_ids):', JSON.stringify({
      id: subscriptionResult.id,
      recipients: subscriptionResult.recipients,
      warnings: subscriptionResult.warnings,
      errors: subscriptionResult.errors,
      subscription_count: subscriptionIds.length,
    }));

    return new Response(JSON.stringify({
      sent: recipientCount(subscriptionResult),
      accepted: Boolean(subscriptionResult.id),
      method: 'subscription_ids',
      onesignal_id: subscriptionResult.id,
      alias_errors: aliasResult.errors || null,
      errors: subscriptionResult.errors || null,
      warnings: subscriptionResult.warnings || null,
      subscription_count: subscriptionIds.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('OneSignal notification error:', err);
    const message = err instanceof Error ? err.message : 'Unknown OneSignal notification error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
