import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  AUTO_COMPLETE_EVENT_STATUSES,
  isEventComplete,
  toRomeDateString,
} from "./event-completion.ts";

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

    const now = new Date();
    const romeDateStr = toRomeDateString(now);

    const { data: candidateEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, title, date, time, duration, status')
      .lte('date', romeDateStr)
      .in('status', AUTO_COMPLETE_EVENT_STATUSES);

    if (fetchError) {
      console.error('Error fetching candidate events:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const completedEventIds = (candidateEvents || [])
      .filter((event) => isEventComplete(event, now))
      .map((event) => event.id);

    let data: Array<{ id: string; title: string }> = [];

    // Mark elapsed public/active events as completed. Do not overwrite draft,
    // upcoming, cancelled, or rescheduled organizer/admin states.
    if (completedEventIds.length > 0) {
      const { data: updatedEvents, error } = await supabase
        .from('events')
        .update({ status: 'completed' })
        .in('id', completedEventIds)
        .in('status', AUTO_COMPLETE_EVENT_STATUSES)
        .select('id, title');

      if (error) {
        console.error('Error updating past events:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      data = updatedEvents || [];
    }

    const count = data?.length || 0;
    console.log(`Marked ${count} events as completed:`, data?.map(e => e.title));

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

    return new Response(JSON.stringify({
      success: true,
      checked: candidateEvents?.length || 0,
      updated: count,
      events: data,
      stale_cleaned: staleRegs?.length || 0,
    }), {
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
