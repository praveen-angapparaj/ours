import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DisconnectReason } from 'livekit-client'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/use-auth'
import { useCouple } from '../couple/use-couple'
import { createCall, expireStaleCalls, getActiveCall, getLiveKitToken, touchCall, updateCallStatus } from './call-service'
import { isLiveCallState, type Call, type CallRuntimeState, type CallType } from './types'

type CallContextValue = {
  state: CallRuntimeState
  notice: string | null
  startCall: (callType?: CallType) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => Promise<void>
  cancelCall: () => Promise<void>
  endCall: () => Promise<void>
  retryConnection: () => void
  markRoomConnected: (callId: string, attempt: number) => void
  reportRoomConnectionError: (callId: string, attempt: number, error: unknown) => void
  reportRoomDisconnected: (callId: string, attempt: number, reason?: DisconnectReason) => void
  reportCallProblem: (error: unknown) => void
  dismissNotice: () => void
}

export const CallContext = createContext<CallContextValue | null>(null)

const activeStatuses = new Set(['ringing', 'accepted'])
const terminalStatuses = new Set(['declined', 'cancelled', 'missed', 'ended'])
// LiveKit's protocol value for DUPLICATE_IDENTITY. Keeping this as a local
// constant preserves call-route code splitting instead of eagerly importing
// the complete WebRTC client just to format one disconnect message.
const duplicateIdentityDisconnectReason = 2 as DisconnectReason
const clientInitiatedDisconnectReason = 1 as DisconnectReason

function asMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'call_failed'
  if (message.includes('call_already_exists')) return 'someone already started this nonsense.'
  if (message.includes('partner_not_found') || message.includes('couple_not_found') || message.includes('relationship_no_longer_active')) return 'your pairing changed. refresh the page and try again.'
  if (message.includes('call_expired')) return 'they did not pick up. tragic.'
  if (message.includes('livekit_token_invalid') || message.includes('livekit_url_invalid')) return 'the call server sent an invalid address. check its setup.'
  if (message.includes('timeout') || message.includes('timed out')) return 'the call server took too long. try again.'
  if (message.includes('microphone') || message.includes('device')) return 'your microphone said no. check its permission and try again.'
  if (message.includes('unauthorized') || message.includes('forbidden')) return 'that call is not yours to join.'
  if (message.includes('network') || message.includes('fetch')) return 'the internet has chosen violence. try again.'
  return 'couldn\'t reach them. try again in a moment.'
}

function stateForCall(call: Call, userId: string): CallRuntimeState {
  if (call.status === 'ringing') {
    return call.caller_id === userId
      ? { status: 'outgoing-ringing', call }
      : { status: 'incoming-ringing', call }
  }
  return { status: 'connecting', call, attempt: 0 }
}

function callFromState(state: CallRuntimeState): Call | null {
  return 'call' in state ? state.call : null
}

function terminalMessage(call: Call, userId: string) {
  if (call.status === 'declined') return 'they declined. perhaps send a suspiciously long text instead.'
  if (call.status === 'cancelled') return call.caller_id === userId ? 'call cancelled.' : 'they hung up before you could answer.'
  if (call.status === 'missed') return 'they did not pick up. tragic.'
  return 'call ended. back to your regularly scheduled nonsense.'
}

function disconnectMessage(reason?: DisconnectReason) {
  if (reason === duplicateIdentityDisconnectReason) return 'this account joined the call somewhere else. close the other tab or device, then try again.'
  return 'the call connection dropped. try reconnecting.'
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const { couple } = useCouple()
  const userId = user?.id
  const coupleId = couple?.id
  const realtimeReady = Boolean(session?.access_token)
  const [state, setState] = useState<CallRuntimeState>({ status: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const stateRef = useRef(state)
  const actionInFlightRef = useRef(false)
  const tokenRequestRef = useRef<string | null>(null)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  stateRef.current = state

  const dismissNotice = useCallback(() => {
    window.clearTimeout(noticeTimerRef.current)
    setNotice(null)
  }, [])

  const notify = useCallback((message: string) => {
    window.clearTimeout(noticeTimerRef.current)
    setNotice(message)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 6_000)
  }, [])

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), [])

  const applyCallUpdate = useCallback((call: Call) => {
    if (!userId || call.couple_id !== coupleId || (call.caller_id !== userId && call.callee_id !== userId)) return

    const currentCall = callFromState(stateRef.current)
    if (terminalStatuses.has(call.status) && currentCall?.id === call.id) {
      notify(terminalMessage(call, userId))
    }

    setState((current) => {
      const activeCall = callFromState(current)

      if (terminalStatuses.has(call.status)) {
        return activeCall?.id === call.id ? { status: 'idle' } : current
      }
      if (!activeStatuses.has(call.status)) return current
      if (activeCall && activeCall.id !== call.id) return current

      if (call.status === 'accepted') {
        // Realtime may replay the accepted row. Never discard a working token or
        // regress a connected room back to its loading state.
        if (current.status === 'connected' || current.status === 'connecting') return current
        return { status: 'connecting', call, attempt: 0 }
      }

      // A late ringing event must not tear down a room that has already accepted.
      if (current.status === 'connecting' || current.status === 'connected') return current
      return stateForCall(call, userId)
    })
  }, [coupleId, notify, userId])

  const reconcileActiveCall = useCallback(async () => {
    if (!userId || !coupleId) return
    const callIdAtRequestStart = callFromState(stateRef.current)?.id ?? null
    const call = await getActiveCall()
    if (call) {
      applyCallUpdate(call)
      return
    }

    // If realtime was unavailable, a successful empty query is authoritative
    // only for the call that existed when this request began. Do not let a
    // slower initial query erase a call the user just created or accepted.
    setState((current) => callIdAtRequestStart && callFromState(current)?.id === callIdAtRequestStart
      ? { status: 'idle' }
      : current)
  }, [applyCallUpdate, coupleId, userId])

  useEffect(() => {
    if (!userId || !coupleId) {
      tokenRequestRef.current = null
      setState({ status: 'idle' })
      return
    }

    tokenRequestRef.current = null
    setState({ status: 'idle' })
    let disposed = false
    void (async () => {
      try {
        await expireStaleCalls()
        if (!disposed) await reconcileActiveCall()
      } catch (error) {
        if (!disposed) notify(asMessage(error))
      }
    })()

    return () => { disposed = true }
  }, [coupleId, notify, reconcileActiveCall, userId])

  useEffect(() => {
    if (session?.access_token) supabase.realtime.setAuth(session.access_token)
  }, [session?.access_token])

  useEffect(() => {
    if (!userId || !coupleId || !realtimeReady) return
    let disposed = false
    const sync = () => {
      void reconcileActiveCall().catch((error) => {
        if (!disposed) notify(asMessage(error))
      })
    }
    const channel = supabase.channel(`calls:${coupleId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `couple_id=eq.${coupleId}`,
      }, (payload) => {
        if (payload.eventType !== 'DELETE') applyCallUpdate(payload.new as Call)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { sync(); return }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') notify('call updates are reconnecting. hang tight.')
      })

    return () => {
      disposed = true
      void supabase.removeChannel(channel)
    }
  }, [applyCallUpdate, coupleId, notify, reconcileActiveCall, realtimeReady, userId])

  useEffect(() => {
    if (!userId || !coupleId || !callFromState(state)) return
    let disposed = false
    const sync = () => {
      void reconcileActiveCall().catch((error) => {
        if (!disposed) notify(asMessage(error))
      })
    }
    const timer = window.setInterval(sync, 15_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) sync() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', sync)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      disposed = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', sync)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [coupleId, notify, reconcileActiveCall, state.status, userId])

  useEffect(() => {
    if (state.status !== 'outgoing-ringing' && state.status !== 'incoming-ringing') return

    const fallbackExpiry = new Date(new Date(state.call.created_at).getTime() + 60_000).getTime()
    const expiry = Date.parse(state.call.ring_expires_at) || fallbackExpiry
    const timeout = window.setTimeout(() => {
      void expireStaleCalls().then(reconcileActiveCall).catch((error) => notify(asMessage(error)))
    }, Math.max(0, expiry - Date.now()) + 100)

    return () => window.clearTimeout(timeout)
  }, [notify, reconcileActiveCall, state])

  const connectedCallId = state.status === 'connected' ? state.call.id : null

  useEffect(() => {
    if (state.status !== 'connected') return
    const checkIn = () => {
      void touchCall(state.call.id).catch(() => undefined)
    }
    checkIn()
    const timer = window.setInterval(checkIn, 30_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkIn()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [connectedCallId])

  useEffect(() => {
    if (state.status !== 'connecting' || state.token || state.serverUrl || state.connectionError) return
    const requestKey = `${state.call.id}:${state.attempt}`
    if (tokenRequestRef.current === requestKey) return

    tokenRequestRef.current = requestKey
    void getLiveKitToken(state.call.id)
      .then(({ token, serverUrl }) => {
        setState((current) => current.status === 'connecting' && current.call.id === state.call.id && current.attempt === state.attempt
          ? { ...current, token, serverUrl }
          : current)
      })
      .catch((error) => {
        const message = asMessage(error)
        setState((current) => current.status === 'connecting' && current.call.id === state.call.id && current.attempt === state.attempt
          ? { ...current, connectionError: message }
          : current)
      })
      .finally(() => {
        if (tokenRequestRef.current === requestKey) tokenRequestRef.current = null
      })
  }, [state])

  const startCall = useCallback(async (callType: CallType = 'audio') => {
    if (!user || !couple || actionInFlightRef.current || stateRef.current.status !== 'idle') return
    actionInFlightRef.current = true
    setState({ status: 'creating' })
    try {
      const call = await createCall(callType)
      setState((current) => current.status === 'creating' ? { status: 'outgoing-ringing', call } : current)
    } catch (error) {
      setState({ status: 'idle' })
      notify(asMessage(error))
    } finally {
      actionInFlightRef.current = false
    }
  }, [couple, notify, user])

  const acceptCall = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== 'incoming-ringing' || actionInFlightRef.current) return
    actionInFlightRef.current = true
    setState({ status: 'accepting', call: current.call })
    try {
      const acceptedCall = await updateCallStatus(current.call.id, 'accepted')
      if (acceptedCall.status !== 'accepted') {
        setState({ status: 'idle' })
        notify(terminalMessage(acceptedCall, user?.id ?? ''))
        return
      }
      setState({ status: 'connecting', call: acceptedCall, attempt: 0 })
    } catch (error) {
      setState({ status: 'idle' })
      notify(asMessage(error))
    } finally {
      actionInFlightRef.current = false
    }
  }, [notify, user?.id])

  const declineCall = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== 'incoming-ringing' || actionInFlightRef.current) return
    actionInFlightRef.current = true
    try {
      await updateCallStatus(current.call.id, 'declined')
      setState({ status: 'idle' })
    } catch (error) {
      notify(asMessage(error))
    } finally {
      actionInFlightRef.current = false
    }
  }, [notify])

  const cancelCall = useCallback(async () => {
    const current = stateRef.current
    if (current.status !== 'outgoing-ringing' || actionInFlightRef.current) return
    actionInFlightRef.current = true
    try {
      await updateCallStatus(current.call.id, 'cancelled')
      setState({ status: 'idle' })
    } catch (error) {
      notify(asMessage(error))
    } finally {
      actionInFlightRef.current = false
    }
  }, [notify])

  const endCall = useCallback(async () => {
    const current = stateRef.current
    if (!isLiveCallState(current) || actionInFlightRef.current) return
    actionInFlightRef.current = true
    try {
      await updateCallStatus(current.call.id, 'ended')
      setState({ status: 'idle' })
    } catch (error) {
      notify(asMessage(error))
    } finally {
      actionInFlightRef.current = false
    }
  }, [notify])

  const retryConnection = useCallback(() => {
    const current = stateRef.current
    if (!isLiveCallState(current)) return
    tokenRequestRef.current = null
    setState({ status: 'connecting', call: current.call, attempt: current.attempt + 1 })
  }, [])

  const markRoomConnected = useCallback((callId: string, attempt: number) => {
    setState((current) => current.status === 'connecting' && current.call.id === callId && current.attempt === attempt && current.token && current.serverUrl
      ? { status: 'connected', call: current.call, token: current.token, serverUrl: current.serverUrl, attempt }
      : current)
  }, [])

  const reportRoomConnectionError = useCallback((callId: string, attempt: number, error: unknown) => {
    const message = asMessage(error)
    setState((current) => isLiveCallState(current) && current.call.id === callId && current.attempt === attempt
      ? { status: 'connecting', call: current.call, attempt, connectionError: message }
      : current)
  }, [])

  const reportRoomDisconnected = useCallback((callId: string, attempt: number, reason?: DisconnectReason) => {
    if (reason === clientInitiatedDisconnectReason) return
    setState((current) => isLiveCallState(current) && current.call.id === callId && current.attempt === attempt
      ? { status: 'connecting', call: current.call, attempt, connectionError: disconnectMessage(reason) }
      : current)
  }, [])

  const reportCallProblem = useCallback((error: unknown) => notify(asMessage(error)), [notify])

  const value = useMemo<CallContextValue>(() => ({
    state,
    notice,
    startCall,
    acceptCall,
    declineCall,
    cancelCall,
    endCall,
    retryConnection,
    markRoomConnected,
    reportRoomConnectionError,
    reportRoomDisconnected,
    reportCallProblem,
    dismissNotice,
  }), [acceptCall, cancelCall, declineCall, dismissNotice, endCall, markRoomConnected, notice, reportCallProblem, reportRoomConnectionError, reportRoomDisconnected, retryConnection, startCall, state])

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
