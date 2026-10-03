import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";
import { AccessToken } from "npm:livekit-server-sdk";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected server error';
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body: unknown = await req.json();
    const callId = typeof body === 'object' && body !== null && 'callId' in body
      ? (body as { callId?: unknown }).callId
      : undefined;

    if (typeof callId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(callId)) {
      return json({ error: 'callId required' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error || !call) {
      return json({ error: 'Call not found' }, 404);
    }

    if (user.id !== call.caller_id && user.id !== call.callee_id) {
      return json({ error: 'Forbidden' }, 403);
    }

    if (call.status !== 'accepted') {
      return json({ error: 'Call is not joinable' }, 400);
    }

    // A historical participant cannot keep obtaining credentials after the pair has changed.
    const { data: members, error: membersError } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', call.couple_id);

    const memberIds = new Set((members ?? []).map((member) => member.user_id));
    if (membersError || memberIds.size !== 2 || !memberIds.has(user.id) || !memberIds.has(call.caller_id) || !memberIds.has(call.callee_id)) {
      return json({ error: 'Call relationship is no longer active' }, 403);
    }

    const roomName = call.room_name;
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const serverUrl = Deno.env.get('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !serverUrl) {
      throw new Error('LiveKit configuration missing on server');
    }
    if (!serverUrl.startsWith('wss://')) {
      throw new Error('LiveKit URL must use wss:// in production');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: '15m',
    });
    
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return json({ token, serverUrl });
  } catch (error: unknown) {
    return json({ error: errorMessage(error) }, 500);
  }
});
