import type { AffectionEvent, AffectionMoment } from './affection-types'

const LIVE_GESTURE_WINDOW_MS = 90_000

export function newRecipientMoments(events: AffectionEvent[], displayedIds: Set<string>, senderName: string | null, now = Date.now()): AffectionMoment[] {
  const moments: AffectionMoment[] = []
  for (const event of events) {
    if ((event.event_type !== 'thinking' && event.event_type !== 'hug') || displayedIds.has(event.id)) continue
    displayedIds.add(event.id)
    const createdAt = Date.parse(event.created_at)
    moments.push({ id: event.id, type: event.event_type, senderName, deferred: Number.isFinite(createdAt) && now - createdAt > LIVE_GESTURE_WINDOW_MS })
  }
  return moments
}
