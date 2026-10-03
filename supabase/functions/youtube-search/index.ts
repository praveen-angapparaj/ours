import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

type YouTubeItem = {
  id?: { videoId?: unknown };
  snippet?: {
    title?: unknown;
    channelTitle?: unknown;
    thumbnails?: { medium?: { url?: unknown }; high?: { url?: unknown }; default?: { url?: unknown } };
  };
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=60' },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected server error';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body: unknown = await req.json();
    const query = typeof body === 'object' && body !== null && 'query' in body
      ? (body as { query?: unknown }).query
      : undefined;
    if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 100) {
      return json({ error: 'Enter between 2 and 100 characters to search.' }, 400);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing Authorization header' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { data: membership, error: membershipError } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError || !membership) return json({ error: 'A paired space is required.' }, 403);

    const { count, error: countError } = await supabase
      .from('couple_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('couple_id', membership.couple_id);
    if (countError || count !== 2) return json({ error: 'A paired space is required.' }, 403);

    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) throw new Error('YouTube search is not configured on the server');
    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    apiUrl.search = new URLSearchParams({
      key: apiKey,
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      safeSearch: 'moderate',
      maxResults: '8',
      q: query.trim(),
    }).toString();

    const response = await fetch(apiUrl);
    const payload: unknown = await response.json();
    if (!response.ok) {
      const reason = typeof payload === 'object' && payload !== null && 'error' in payload
        ? (payload as { error?: { message?: unknown } }).error?.message
        : undefined;
      return json({ error: typeof reason === 'string' ? reason : 'YouTube search is temporarily unavailable.' }, response.status === 403 ? 429 : 502);
    }

    const items = typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: YouTubeItem[] }).items
      : [];
    const results = items.flatMap((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      const channelTitle = item.snippet?.channelTitle;
      const thumbnail = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url;
      if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId) || typeof title !== 'string' || typeof channelTitle !== 'string' || typeof thumbnail !== 'string') return [];
      return [{ videoId, title, channelTitle, thumbnail }];
    });

    return json({ results });
  } catch (error: unknown) {
    return json({ error: errorMessage(error) }, 500);
  }
});
