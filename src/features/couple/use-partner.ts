import { useCouple } from './use-couple'

export function usePartner() {
  const { partner, state, error } = useCouple()
  return { partner, loading: state === 'loading', error }
}
