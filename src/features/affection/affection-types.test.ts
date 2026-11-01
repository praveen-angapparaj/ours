import { describe, expect, it } from 'vitest'
import { affectionMomentCopy, isAffectionEvent } from './affection-types'

describe('affection event contracts', () => {
  it('accepts a complete durable Love Drop row', () => {
    expect(isAffectionEvent({ id: 'event-a', couple_id: 'couple-a', sender_id: 'sender-a', recipient_id: 'recipient-b', event_type: 'love_drop', message: 'For later.', client_event_id: 'client-a', created_at: '2026-10-19T00:00:00.000Z', notified_at: null, opened_at: null })).toBe(true)
  })

  it('rejects incomplete or unsupported server payloads', () => {
    expect(isAffectionEvent({ id: 'event-a', event_type: 'kiss' })).toBe(false)
    expect(isAffectionEvent(null)).toBe(false)
  })

  it('uses the actual partner name in a gesture, with a neutral fallback', () => {
    expect(affectionMomentCopy({ id: 'event-a', type: 'thinking', senderName: 'Mira', deferred: false })).toBe('Mira is thinking of you.')
    expect(affectionMomentCopy({ id: 'event-b', type: 'hug', senderName: null, deferred: false })).toBe('A quiet hug found its way to you.')
    expect(affectionMomentCopy({ id: 'event-c', type: 'hug', senderName: 'Mira', deferred: true })).toBe('Mira left a warm embrace for you.')
  })
})
