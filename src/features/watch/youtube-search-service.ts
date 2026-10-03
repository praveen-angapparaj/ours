import { supabase } from '../../lib/supabase'

export type YouTubeSearchResult = {
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
}

function isSearchResult(value: unknown): value is YouTubeSearchResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return typeof result.videoId === 'string'
    && /^[A-Za-z0-9_-]{11}$/.test(result.videoId)
    && typeof result.title === 'string'
    && typeof result.channelTitle === 'string'
    && typeof result.thumbnail === 'string'
}

export async function searchYouTube(query: string) {
  const { data, error } = await supabase.functions.invoke('youtube-search', { body: { query } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(String(data.error))
  if (!Array.isArray(data?.results)) throw new Error('youtube_search_response_invalid')
  return data.results.filter(isSearchResult)
}
