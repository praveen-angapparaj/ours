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

function trustedThumbnailUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'i.ytimg.com' || !url.pathname.startsWith('/vi/')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body: unknown = await req.json();
    const query = typeof body === 'object' && body !== null && 'query' in body
      ? (body as { query?: unknown }).query
      : undefined;
    const category = typeof body === 'object' && body !== null && 'category' in body
      ? (body as { category?: unknown }).category
      : 'video';
    if (typeof query !== 'string' || query.trim().length < 2 || query.trim().length > 100) {
      return json({ error: 'Enter between 2 and 100 characters to search.' }, 400);
    }
    if (category !== 'video' && category !== 'music') {
      return json({ error: 'Choose either video or music search.' }, 400);
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
    const searchParams = new URLSearchParams({
      key: apiKey,
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      safeSearch: 'moderate',
      maxResults: '8',
      q: query.trim(),
    });
    if (category === 'music') searchParams.set('videoCategoryId', '10');
    apiUrl.search = searchParams.toString();

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
      const safeThumbnail = trustedThumbnailUrl(thumbnail);
      if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)
        || typeof title !== 'string' || title.trim().length === 0 || title.length > 300
        || typeof channelTitle !== 'string' || channelTitle.trim().length === 0 || channelTitle.length > 200
        || !safeThumbnail) return [];
      return [{ videoId, title: title.trim(), channelTitle: channelTitle.trim(), thumbnail: safeThumbnail }];
    });

    return json({ results });
  } catch (error: unknown) {
    return json({ error: errorMessage(error) }, 500);
  }
});
