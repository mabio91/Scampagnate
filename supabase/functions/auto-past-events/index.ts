import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date in Europe/Rome timezone
    const now = new Date();
    const romeDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD

    // Update all events whose date is before today and status is not already past/cancelled/draft
    const { data, error } = await supabase
      .from('events')
      .update({ status: 'past' })
      .lt('date', romeDateStr)
      .in('status', ['published', 'full', 'closed'])
      .select('id, title');

    if (error) {
      console.error('Error updating past events:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const count = data?.length || 0;
    console.log(`Marked ${count} events as past:`, data?.map(e => e.title));

    // Clean up stale pending registrations (older than 30 minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleRegs, error: staleError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('payment_status', 'pending')
      .lt('created_at', thirtyMinAgo)
      .select('id');

    if (staleError) {
      console.error('Error cleaning stale registrations:', staleError);
    } else {
      console.log(`Cleaned up ${staleRegs?.length || 0} stale pending registrations`);
    }

    return new Response(JSON.stringify({ success: true, updated: count, events: data, stale_cleaned: staleRegs?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
