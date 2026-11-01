import type { WatchSession } from './watch-types'

// PostgreSQL assigns state_version atomically. A delayed durable event may
// arrive after a newer one, but a session from another relationship must never
// affect the current relationship's ordering.
export function shouldAcceptWatchSession(current: WatchSession | null, next: WatchSession) {
  return !current || next.couple_id !== current.couple_id || next.state_version >= current.state_version
}
