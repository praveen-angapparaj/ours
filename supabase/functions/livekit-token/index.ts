import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected server error';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: unknown = await req.json();
    const callId = typeof body === 'object' && body !== null && 'callId' in body
      ? (body as { callId?: unknown }).callId
      : undefined;

    if (typeof callId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId)) {
      return new Response(JSON.stringify({ error: 'callId required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return new Response(JSON.stringify({ error: 'Call not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (user.id !== call.caller_id && user.id !== call.callee_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (call.status !== 'accepted') {
      return new Response(JSON.stringify({ error: 'Call is not joinable' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // A historical participant cannot keep obtaining credentials after the pair has changed.
    const { data: members, error: membersError } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', call.couple_id);

    const memberIds = new Set((members ?? []).map((member) => member.user_id));
    if (membersError || memberIds.size !== 2 || !memberIds.has(user.id) || !memberIds.has(call.caller_id) || !memberIds.has(call.callee_id)) {
      return new Response(JSON.stringify({ error: 'Call relationship is no longer active' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const roomName = call.room_name;
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const serverUrl = Deno.env.get('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !serverUrl) {
      throw new Error('LiveKit configuration missing on server');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: '2h',
    });
    
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token, serverUrl }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
