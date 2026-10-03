import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/use-auth'
import { useCouple } from '../couple/use-couple'
import { createCall, expireStaleCalls, getActiveCall, getLiveKitToken, updateCallStatus } from './call-service'
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
  markRoomConnected: (callId: string) => void
  reportCallProblem: (error: unknown) => void
  dismissNotice: () => void
}

export const CallContext = createContext<CallContextValue | null>(null)

const activeStatuses = new Set(['ringing', 'accepted'])
const terminalStatuses = new Set(['declined', 'cancelled', 'missed', 'ended'])

function asMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'call_failed'
  if (message.includes('call_already_exists')) return 'someone already started this nonsense.'
  if (message.includes('partner_not_found') || message.includes('couple_not_found') || message.includes('relationship_no_longer_active')) return 'your pairing changed. refresh the page and try again.'
  if (message.includes('call_expired')) return 'they did not pick up. tragic.'
  if (message.includes('media_action_timeout')) return 'your microphone is still reconnecting. give it another tap in a moment.'
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

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { couple } = useCouple()
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
    if (!user || call.couple_id !== couple?.id || (call.caller_id !== user.id && call.callee_id !== user.id)) return

    const currentCall = callFromState(stateRef.current)
    if (terminalStatuses.has(call.status) && currentCall?.id === call.id) {
      notify(terminalMessage(call, user.id))
    }

    setState((current) => {
      const activeCall = callFromState(current)

      if (terminalStatuses.has(call.status)) {
        if (activeCall?.id !== call.id) return current
        return { status: 'idle' }
      }

      if (!activeStatuses.has(call.status)) return current
      if (activeCall && activeCall.id !== call.id) return current
      if (call.status === 'accepted') return { status: 'connecting', call, attempt: 0 }
      return stateForCall(call, user.id)
    })
  }, [couple?.id, notify, user])

  useEffect(() => {
    if (!user || !couple) {
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
        const call = await getActiveCall()
        if (!disposed && call) applyCallUpdate(call)
      } catch (error) {
        if (!disposed) notify(asMessage(error))
      }
    })()

    return () => { disposed = true }
  }, [applyCallUpdate, couple?.id, notify, user?.id])

  useEffect(() => {
    if (!user || !couple) return

    const channel = supabase.channel(`calls:${couple.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `couple_id=eq.${couple.id}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') return
        applyCallUpdate(payload.new as Call)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          notify('call updates are reconnecting. hang tight.')
        }
      })

    return () => { void supabase.removeChannel(channel) }
  }, [applyCallUpdate, couple?.id, notify, user?.id])

  useEffect(() => {
    if (state.status !== 'outgoing-ringing' && state.status !== 'incoming-ringing') return

    const fallbackExpiry = new Date(new Date(state.call.created_at).getTime() + 35_000).getTime()
    const expiry = Date.parse(state.call.ring_expires_at) || fallbackExpiry
    const timeout = window.setTimeout(() => {
      void expireStaleCalls().catch((error) => notify(asMessage(error)))
    }, Math.max(0, expiry - Date.now()) + 100)

    return () => window.clearTimeout(timeout)
  }, [notify, state])

  useEffect(() => {
    if (state.status !== 'connecting' || state.token || state.serverUrl) return
    const requestKey = `${state.call.id}:${state.attempt}`
    if (tokenRequestRef.current === requestKey) return

    tokenRequestRef.current = requestKey
    void getLiveKitToken(state.call.id)
      .then(({ token, serverUrl }) => {
        setState((current) => current.status === 'connecting' && current.call.id === state.call.id && current.attempt === state.attempt
          ? { ...current, token, serverUrl }
          : current)
      })
      .catch((error) => notify(asMessage(error)))
      .finally(() => {
        if (tokenRequestRef.current === requestKey) tokenRequestRef.current = null
      })
  }, [notify, state])

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
    setState({ status: 'connecting', call: current.call, attempt: current.status === 'connecting' ? current.attempt + 1 : 1 })
  }, [])

  const markRoomConnected = useCallback((callId: string) => {
    setState((current) => current.status === 'connecting' && current.call.id === callId && current.token && current.serverUrl
      ? { status: 'connected', call: current.call, token: current.token, serverUrl: current.serverUrl }
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
    reportCallProblem,
    dismissNotice,
  }), [acceptCall, cancelCall, declineCall, dismissNotice, endCall, markRoomConnected, notice, reportCallProblem, retryConnection, startCall, state])

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}
