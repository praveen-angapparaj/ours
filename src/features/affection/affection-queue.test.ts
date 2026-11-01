import { describe, expect, it } from 'vitest'
import { newRecipientMoments } from './affection-queue'
import type { AffectionEvent } from './affection-types'

function event(id: string, event_type: AffectionEvent['event_type']): AffectionEvent {
  return { id, event_type, couple_id: 'couple-a', sender_id: 'sender-a', recipient_id: 'recipient-b', message: event_type === 'love_drop' ? 'For later.' : null, client_event_id: `00000000-0000-4000-8000-${id.padStart(12, '0')}`, created_at: '2026-10-19T00:00:00.000Z', notified_at: null, opened_at: null }
}

describe('newRecipientMoments', () => {
  it('keeps only recipient gestures and never repeats a displayed event', () => {
    const displayed = new Set(['one'])
    const moments = newRecipientMoments([event('one', 'thinking'), event('two', 'love_drop'), event('three', 'hug')], displayed, 'Mira', Date.parse('2026-10-19T00:00:20.000Z'))

    expect(moments).toEqual([{ id: 'three', type: 'hug', senderName: 'Mira', deferred: false }])
    expect(displayed).toEqual(new Set(['one', 'three']))
  })

  it('preserves a missing partner name rather than inventing one', () => {
    const moments = newRecipientMoments([event('four', 'thinking')], new Set(), null, Date.parse('2026-10-19T00:02:00.000Z'))
    expect(moments[0].senderName).toBeNull()
    expect(moments[0].deferred).toBe(true)
  })
})
