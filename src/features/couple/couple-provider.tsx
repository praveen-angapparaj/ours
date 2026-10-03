import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/use-auth'
import { cancelMyUnpairedCouple, createMyCouple, friendlyPairingError, joinCoupleByCode, loadCoupleSnapshot, updateRelationshipDate } from './couple-service'
import type { CoupleSnapshot } from './pairing-types'

type CoupleContextValue = CoupleSnapshot & { refresh: () => Promise<void>; createSpace: () => Promise<string>; joinWithCode: (code: string) => Promise<void>; cancelWaitingSpace: () => Promise<void>; setRelationshipDate: (date: string) => Promise<void> }
const emptySnapshot: CoupleSnapshot = { state: 'loading', couple: null, members: [], partner: null, error: null }
export const CoupleContext = createContext<CoupleContextValue | null>(null)

export function CoupleProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [snapshot, setSnapshot] = useState<CoupleSnapshot>(emptySnapshot)
  const refreshRequestRef = useRef(0)
  const refresh = useCallback(async (quiet = false) => {
    if (!user) { refreshRequestRef.current += 1; setSnapshot({ state: 'unpaired', couple: null, members: [], partner: null, error: null }); return }
    const requestId = ++refreshRequestRef.current
    if (!quiet) setSnapshot((current) => current.state === 'loading' || !current.couple
      ? { ...current, state: 'loading', error: null }
      : { ...current, error: null })
    try {
      const next = await loadCoupleSnapshot(user.id)
      if (requestId === refreshRequestRef.current) setSnapshot(next)
    } catch (error) {
      if (requestId !== refreshRequestRef.current) return
      const snapshotError = error as { code?: string; message?: string; details?: string | null; hint?: string | null }
      console.error(`[Our Space] couple snapshot failed - code: ${snapshotError.code ?? 'unknown'} | message: ${snapshotError.message ?? 'unknown'} | details: ${snapshotError.details ?? 'none'} | hint: ${snapshotError.hint ?? 'none'}`)
      setSnapshot((current) => current.couple
        ? { ...current, error: friendlyPairingError(snapshotError as Error) }
        : { state: 'error', couple: null, members: [], partner: null, error: friendlyPairingError(snapshotError as Error) })
    }
  }, [user])
  useEffect(() => { if (authLoading) return; void refresh() }, [authLoading, refresh])
  useEffect(() => {
    if (!user || !snapshot.couple) return
    const channel = supabase.channel(`couple-data-${snapshot.couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_members', filter: `couple_id=eq.${snapshot.couple.id}` }, () => { void refresh(true) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${snapshot.couple.id}` }, () => { void refresh(true) })
    if (snapshot.partner) channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${snapshot.partner.id}` }, () => { void refresh(true) })
    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user, snapshot.couple?.id, snapshot.partner?.id, refresh])
  useEffect(() => {
    if (!user) return
    const revalidate = () => { void refresh(true).catch(() => undefined) }
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) revalidate() }
    window.addEventListener('online', revalidate)
    window.addEventListener('pageshow', onPageShow)
    return () => { window.removeEventListener('online', revalidate); window.removeEventListener('pageshow', onPageShow) }
  }, [refresh, user])
  const createSpace = useCallback(async () => { try { const result = await createMyCouple(); await refresh(); return result.invite_code } catch (error) { const rpcError = error as { code?: string; message?: string; details?: string | null; hint?: string | null }; console.error(`[Our Space] create_my_couple failed - code: ${rpcError.code ?? 'unknown'} | message: ${rpcError.message ?? 'unknown'} | details: ${rpcError.details ?? 'none'} | hint: ${rpcError.hint ?? 'none'}`); const message = friendlyPairingError(rpcError as Error); setSnapshot((current) => ({ ...current, state: 'error', error: message })); throw new Error(message) } }, [refresh])
  const joinWithCode = useCallback(async (code: string) => { try { await joinCoupleByCode(code); await refresh() } catch (error) { const rpcError = error as { code?: string; message?: string; details?: string | null; hint?: string | null }; console.error(`[Our Space] join_couple_by_code failed — code: ${rpcError.code ?? 'unknown'} | message: ${rpcError.message ?? 'unknown'} | details: ${rpcError.details ?? 'none'} | hint: ${rpcError.hint ?? 'none'}`); const message = friendlyPairingError(new Error(rpcError.message ?? 'pairing_error_without_message')); throw new Error(message) } }, [refresh])
  const cancelWaitingSpace = useCallback(async () => { try { await cancelMyUnpairedCouple(); await refresh() } catch (error) { const message = friendlyPairingError(error as Error); throw new Error(message) } }, [refresh])
  const setRelationshipDate = useCallback(async (date: string) => { try { await updateRelationshipDate(date); await refresh(true) } catch (error) { throw new Error(friendlyPairingError(error as Error)) } }, [refresh])
  const value = useMemo<CoupleContextValue>(() => ({ ...snapshot, refresh, createSpace, joinWithCode, cancelWaitingSpace, setRelationshipDate }), [snapshot, refresh, createSpace, joinWithCode, cancelWaitingSpace, setRelationshipDate])
  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>
}
