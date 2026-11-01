import { describe, expect, it } from 'vitest'
import { expectedWatchPosition, type WatchSession } from './watch-types'
import { shouldAcceptWatchSession } from './watch-sync'

const session = (overrides: Partial<WatchSession> = {}): WatchSession => ({
  id: 'session-1',
  couple_id: 'couple-1',
  provider: 'youtube',
  media_id: 'abcDEF12345',
  playback_state: 'paused',
  position_seconds: 12,
  state_version: 4,
  updated_by: 'user-1',
  created_at: '2026-10-19T00:00:00.000Z',
  updated_at: '2026-10-19T00:00:00.000Z',
  ...overrides,
})

describe('watch canonical state', () => {
  it('rejects a delayed durable event for the same relationship', () => {
    expect(shouldAcceptWatchSession(session(), session({ state_version: 3 }))).toBe(false)
    expect(shouldAcceptWatchSession(session(), session({ state_version: 4 }))).toBe(true)
    expect(shouldAcceptWatchSession(session(), session({ state_version: 5 }))).toBe(true)
  })

  it('keeps relationship ordering isolated', () => {
    expect(shouldAcceptWatchSession(session(), session({ couple_id: 'couple-2', state_version: 1 }))).toBe(true)
  })

  it('derives playback progress from the canonical timestamp without writes', () => {
    const playing = session({ playback_state: 'playing', position_seconds: 12, updated_at: '2026-10-19T00:00:00.000Z' })
    expect(expectedWatchPosition(playing, Date.parse('2026-10-19T00:00:04.250Z'))).toBe(16.25)
    expect(expectedWatchPosition(session({ playback_state: 'paused' }), Date.parse('2026-10-19T00:00:04.250Z'))).toBe(12)
  })
})
