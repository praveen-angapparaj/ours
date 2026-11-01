import { supabase } from '../../lib/supabase'

export type YouTubeSearchResult = {
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
}

export type YouTubeSearchCategory = 'video' | 'music'

function isTrustedThumbnailUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'i.ytimg.com' && url.pathname.startsWith('/vi/')
  } catch {
    return false
  }
}

function isSearchResult(value: unknown): value is YouTubeSearchResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return typeof result.videoId === 'string'
    && /^[A-Za-z0-9_-]{11}$/.test(result.videoId)
    && typeof result.title === 'string' && result.title.trim().length > 0 && result.title.length <= 300
    && typeof result.channelTitle === 'string' && result.channelTitle.trim().length > 0 && result.channelTitle.length <= 200
    && typeof result.thumbnail === 'string' && isTrustedThumbnailUrl(result.thumbnail)
}

export async function searchYouTube(query: string, category: YouTubeSearchCategory = 'video') {
  const { data, error } = await supabase.functions.invoke('youtube-search', { body: { query, category } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(String(data.error))
  if (!Array.isArray(data?.results)) throw new Error('youtube_search_response_invalid')
  return data.results.filter(isSearchResult)
}
