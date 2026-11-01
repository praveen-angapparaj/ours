import { useContext } from 'react'
import { AffectionContext } from './AffectionProvider'

export function useAffection() {
  const context = useContext(AffectionContext)
  if (!context) throw new Error('useAffection must be used inside AffectionProvider')
  return context
}
