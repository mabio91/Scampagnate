import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, message, event_id, type } = await req.json();

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

    // Get all OneSignal player IDs for this user
    const { data: players, error } = await supabase
      .from('onesignal_players')
      .select('player_id')
      .eq('user_id', user_id);

    if (error) {
      console.error('Error fetching players:', error);
      throw error;
    }

    if (!players || players.length === 0) {
      // Fallback: try sending via external_user_id (OneSignal login)
      const url = event_id ? `/event/${event_id}` : '/';

      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${onesignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: onesignalAppId,
          include_aliases: { external_id: [user_id] },
          target_channel: 'push',
          headings: { en: title },
          contents: { en: message || '' },
          url: `https://scampagnate.com${url}`,
          web_push_type: 'Notification',
        }),
      });

      const result = await response.json();
      console.log('OneSignal response (alias):', JSON.stringify(result));

      return new Response(JSON.stringify({ sent: result.recipients || 0, method: 'alias' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const playerIds = players.map((p: any) => p.player_id);
    const url = event_id ? `/event/${event_id}` : '/';

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${onesignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: onesignalAppId,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message || '' },
        url: `https://scampagnate.com${url}`,
        web_push_type: 'Notification',
        data: { type: type || 'info', event_id: event_id || null },
      }),
    });

    const result = await response.json();
    console.log('OneSignal response:', JSON.stringify(result));

    return new Response(JSON.stringify({
      sent: result.recipients || 0,
      onesignal_id: result.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('OneSignal notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
