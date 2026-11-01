import { describe, expect, it } from 'vitest'
import { isCallTransitionRace } from './call-lifecycle'

describe('call lifecycle races', () => {
  it('recognizes a state transition resolved by the other participant', () => {
    expect(isCallTransitionRace(new Error('invalid_transition'))).toBe(true)
    expect(isCallTransitionRace(new Error('call_not_found'))).toBe(true)
  })

  it('does not hide genuine transport failures as a race', () => {
    expect(isCallTransitionRace(new Error('network request failed'))).toBe(false)
  })
})
