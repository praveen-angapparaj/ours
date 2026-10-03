export type WatchPlaybackState = 'empty' | 'paused' | 'playing' | 'ended'
export type WatchProviderName = 'youtube'

export type WatchSession = {
  id: string
  couple_id: string
  provider: WatchProviderName | null
  media_id: string | null
  playback_state: WatchPlaybackState
  position_seconds: number
  state_version: number
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type WatchMutation = {
  provider: WatchProviderName | null
  mediaId: string | null
  playbackState: WatchPlaybackState
  positionSeconds: number
}

export type WatchRealtimeState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export function isWatchPlaybackState(value: unknown): value is WatchPlaybackState {
  return value === 'empty' || value === 'paused' || value === 'playing' || value === 'ended'
}

export function isWatchSession(value: unknown): value is WatchSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  return typeof session.id === 'string'
    && typeof session.couple_id === 'string'
    && (session.provider === null || session.provider === 'youtube')
    && (session.media_id === null || typeof session.media_id === 'string')
    && isWatchPlaybackState(session.playback_state)
    && typeof session.position_seconds === 'number'
    && Number.isFinite(session.position_seconds)
    && typeof session.state_version === 'number'
    && typeof session.updated_at === 'string'
}

export function expectedWatchPosition(session: WatchSession, now = Date.now()) {
  if (session.playback_state !== 'playing') return session.position_seconds
  const updatedAt = Date.parse(session.updated_at)
  if (!Number.isFinite(updatedAt)) return session.position_seconds
  return Math.max(0, session.position_seconds + Math.max(0, now - updatedAt) / 1_000)
}
