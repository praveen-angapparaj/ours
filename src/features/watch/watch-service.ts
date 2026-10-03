import { supabase } from '../../lib/supabase'
import { isWatchSession, type WatchMutation, type WatchSession } from './watch-types'

function asWatchSession(value: unknown): WatchSession {
  const row = Array.isArray(value) ? value[0] : value
  if (!isWatchSession(row)) throw new Error('watch_session_response_was_invalid')
  return row
}

export async function getWatchSession() {
  const { data, error } = await supabase.rpc('get_watch_session')
  if (error) throw error
  return asWatchSession(data)
}

export async function updateWatchSession(mutation: WatchMutation) {
  const { data, error } = await supabase.rpc('update_watch_session', {
    requested_provider: mutation.provider,
    requested_media_id: mutation.mediaId,
    requested_playback_state: mutation.playbackState,
    requested_position_seconds: mutation.positionSeconds,
  })
  if (error) throw error
  return asWatchSession(data)
}

export function friendlyWatchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('watch_session_requires_a_paired_couple')) return 'Watch together unlocks once both people have joined this space.'
  if (message.includes('invalid_youtube_media_id')) return 'That YouTube link did not look quite right. Try another video link.'
  if (message.includes('invalid_watch_position') || message.includes('invalid_playback_state')) return 'That sync update was not valid. Please try again.'
  if (message.includes('permission') || message.includes('row-level security')) return 'This watch room belongs to your paired space. Refresh and try again.'
  return 'The shared player could not save that yet. Check your connection and try again.'
}
