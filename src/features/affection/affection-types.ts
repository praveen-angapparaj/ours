export type AffectionEventType = 'thinking' | 'hug' | 'love_drop'
export type AffectionMomentType = Extract<AffectionEventType, 'thinking' | 'hug'>

export type AffectionEvent = {
  id: string
  couple_id: string
  sender_id: string
  recipient_id: string
  event_type: AffectionEventType
  message: string | null
  client_event_id: string
  created_at: string
  notified_at: string | null
  opened_at: string | null
}

export type AffectionMoment = {
  id: string
  type: AffectionMomentType
  senderName: string | null
  deferred: boolean
}

export function isAffectionEventType(value: unknown): value is AffectionEventType {
  return value === 'thinking' || value === 'hug' || value === 'love_drop'
}

export function isAffectionEvent(value: unknown): value is AffectionEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  return typeof event.id === 'string'
    && typeof event.couple_id === 'string'
    && typeof event.sender_id === 'string'
    && typeof event.recipient_id === 'string'
    && isAffectionEventType(event.event_type)
    && (event.message === null || typeof event.message === 'string')
    && typeof event.client_event_id === 'string'
    && typeof event.created_at === 'string'
    && (event.notified_at === null || typeof event.notified_at === 'string')
    && (event.opened_at === null || typeof event.opened_at === 'string')
}

export function isLoveDrop(event: AffectionEvent) {
  return event.event_type === 'love_drop'
}

export function affectionMomentCopy(moment: AffectionMoment) {
  const name = moment.senderName?.trim()
  if (moment.deferred && moment.type === 'hug') return name ? `${name} left a warm embrace for you.` : 'A warm embrace was waiting for you.'
  if (moment.deferred) return name ? `${name} left you a little thought.` : 'A little thought was waiting for you.'
  if (moment.type === 'hug') return name ? `${name} sent you a quiet hug.` : 'A quiet hug found its way to you.'
  return name ? `${name} is thinking of you.` : "Someone's thinking of you."
}
