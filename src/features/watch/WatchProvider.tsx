import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/use-auth'
import { useCouple } from '../couple/use-couple'
import { friendlyWatchError, getWatchSession, updateWatchSession } from './watch-service'
import type { WatchMutation, WatchRealtimeState, WatchSession } from './watch-types'
import { isWatchSession } from './watch-types'

type WatchContextValue = {
  session: WatchSession | null
  loading: boolean
  saving: boolean
  error: string | null
  realtimeState: WatchRealtimeState
  refresh: () => Promise<void>
  setVideo: (mediaId: string) => Promise<void>
  setPlayback: (playbackState: Exclude<WatchMutation['playbackState'], 'empty'>, positionSeconds: number) => Promise<void>
  clearVideo: () => Promise<void>
  clearError: () => void
}

export const WatchContext = createContext<WatchContextValue | null>(null)

function payloadSession(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const next = (payload as { new?: unknown }).new
  return isWatchSession(next) ? next : null
}

export function WatchProvider({ children }: { children: ReactNode }) {
  const { user, session: authSession } = useAuth()
  const { couple, state: pairingState } = useCouple()
  const [session, setSession] = useState<WatchSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingCount, setSavingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [realtimeState, setRealtimeState] = useState<WatchRealtimeState>('disconnected')
  const mountedRef = useRef(true)
  const sessionRef = useRef<WatchSession | null>(null)
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve())

  const acceptSession = useCallback((next: WatchSession) => {
    const current = sessionRef.current
    if (current && next.couple_id === current.couple_id && next.state_version < current.state_version) return
    sessionRef.current = next
    if (mountedRef.current) setSession(next)
  }, [])

  const refresh = useCallback(async () => {
    if (!user || !couple || pairingState !== 'paired') return
    try {
      const next = await getWatchSession()
      if (next.couple_id !== couple.id) throw new Error('watch_session_couple_mismatch')
      acceptSession(next)
      if (mountedRef.current) setError(null)
    } catch (requestError) {
      if (mountedRef.current) setError(friendlyWatchError(requestError))
      throw requestError
    }
  }, [acceptSession, couple, pairingState, user])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!user || !couple || pairingState !== 'paired') {
      sessionRef.current = null
      setSession(null)
      setLoading(false)
      setError(null)
      setRealtimeState('disconnected')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void getWatchSession()
      .then((next) => {
        if (cancelled || next.couple_id !== couple.id) return
        acceptSession(next)
      })
      .catch((requestError) => {
        if (!cancelled) setError(friendlyWatchError(requestError))
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [acceptSession, couple, pairingState, user])

  useEffect(() => {
    if (!user || !couple || pairingState !== 'paired' || !authSession?.access_token) return
    supabase.realtime.setAuth(authSession.access_token)
    let disposed = false
    const channel = supabase
      // Postgres Changes is protected by the watch_sessions SELECT policy. This
      // stays a normal channel so it does not require a separate realtime.messages
      // authorization policy just to receive table changes.
      .channel(`watch-session:${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_sessions', filter: `couple_id=eq.${couple.id}` }, (payload) => {
        const next = payloadSession(payload)
        if (next && next.couple_id === couple.id) acceptSession(next)
      })

    channel.subscribe((status) => {
      if (disposed) return
      if (status === 'SUBSCRIBED') {
        setRealtimeState('connected')
        void refresh().catch(() => undefined)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeState('reconnecting')
      } else if (status === 'CLOSED') {
        setRealtimeState('disconnected')
      }
    })

    return () => { disposed = true; void supabase.removeChannel(channel) }
  }, [acceptSession, authSession?.access_token, couple, pairingState, refresh, user])

  useEffect(() => {
    if (!user || !couple || pairingState !== 'paired') return
    const refreshOnVisible = () => { if (document.visibilityState === 'visible') void refresh().catch(() => undefined) }
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh().catch(() => undefined) }, 45_000)
    document.addEventListener('visibilitychange', refreshOnVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshOnVisible) }
  }, [couple, pairingState, refresh, user])

  const queueMutation = useCallback((mutation: WatchMutation) => {
    const execute = async () => {
      if (!user || !couple || pairingState !== 'paired') throw new Error('watch_session_requires_a_paired_couple')
      if (mountedRef.current) { setSavingCount((count) => count + 1); setError(null) }
      try {
        const next = await updateWatchSession(mutation)
        if (next.couple_id !== couple.id) throw new Error('watch_session_couple_mismatch')
        acceptSession(next)
      } catch (requestError) {
        if (mountedRef.current) setError(friendlyWatchError(requestError))
        throw requestError
      } finally {
        if (mountedRef.current) setSavingCount((count) => Math.max(0, count - 1))
      }
    }
    const task = mutationQueueRef.current.catch(() => undefined).then(execute)
    mutationQueueRef.current = task.catch(() => undefined)
    return task
  }, [acceptSession, couple, pairingState, user])

  const setVideo = useCallback((mediaId: string) => queueMutation({ provider: 'youtube', mediaId, playbackState: 'paused', positionSeconds: 0 }), [queueMutation])
  const setPlayback = useCallback((playbackState: Exclude<WatchMutation['playbackState'], 'empty'>, positionSeconds: number) => {
    const current = sessionRef.current
    if (!current?.media_id || !current.provider) return Promise.reject(new Error('watch_session_has_no_video'))
    return queueMutation({ provider: current.provider, mediaId: current.media_id, playbackState, positionSeconds: Math.max(0, Number.isFinite(positionSeconds) ? positionSeconds : 0) })
  }, [queueMutation])
  const clearVideo = useCallback(() => queueMutation({ provider: null, mediaId: null, playbackState: 'empty', positionSeconds: 0 }), [queueMutation])
  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<WatchContextValue>(() => ({
    session,
    loading,
    saving: savingCount > 0,
    error,
    realtimeState,
    refresh,
    setVideo,
    setPlayback,
    clearVideo,
    clearError,
  }), [clearError, clearVideo, error, loading, realtimeState, refresh, savingCount, session, setPlayback, setVideo])

  return <WatchContext.Provider value={value}>{children}</WatchContext.Provider>
}
