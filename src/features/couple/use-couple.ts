import { useContext } from 'react'
import { CoupleContext } from './couple-provider'

export function useCouple() {
  const context = useContext(CoupleContext)
  if (!context) throw new Error('useCouple must be used inside CoupleProvider')
  return context
}
