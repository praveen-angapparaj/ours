import { useContext } from 'react'
import { CouplePresenceContext } from './presence-provider'

export function useCouplePresence() {
  return useContext(CouplePresenceContext)
}
