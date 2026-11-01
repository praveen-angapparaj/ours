import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/use-auth'
import { useCouple } from '../couple/use-couple'
import { claimPendingAffectionEvents, getLoveDrops, openLoveDrop, sendAffectionEvent } from './affection-service'
import { isLoveDrop, type AffectionEvent, type AffectionEventType, type AffectionMoment, type AffectionMomentType } from './affection-types'
import { newRecipientMoments } from './affection-queue'

type AffectionContextValue = {
  moment: AffectionMoment | null
  letterDeskOpen: boolean
  loveDrops: AffectionEvent[]
  unreadLoveDropCount: number
  loveDropsLoading: boolean
  sendMoment: (type: AffectionMomentType, clientEventId: string) => Promise<AffectionEvent>
  sendLoveDrop: (message: string, clientEventId: string) => Promise<AffectionEvent>
  openDrop: (eventId: string) => Promise<AffectionEvent>
  refreshLoveDrops: () => Promise<void>
  setLetterDeskOpen: (open: boolean) => void
}

export const AffectionContext = createContext<AffectionContextValue | null>(null)

// The arrival scene keeps its final constellation/afterglow on screen until
// these handoff points. Keeping the queue timing here explicit prevents a
// future visual change from silently leaving only a darkened sky behind.
const momentDurationMs = {
  thinking: 3_800,
  hug: 4_800,
} as const

function nextMomentFromQueue(queue: AffectionMoment[]) {
  return queue.shift() ?? null
}

export function AffectionProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const { couple, partner, state: pairingState } = useCouple()
  const [moment, setMoment] = useState<AffectionMoment | null>(null)
  const [letterDeskOpen, setLetterDeskOpen] = useState(false)
  const [loveDrops, setLoveDrops] = useState<AffectionEvent[]>([])
  const [loveDropsLoading, setLoveDropsLoading] = useState(false)
  const mountedRef = useRef(true)
  const momentRef = useRef<AffectionMoment | null>(null)
  const momentQueueRef = useRef<AffectionMoment[]>([])
  const displayedMomentIdsRef = useRef<Set<string>>(new Set())
  const claimInFlightRef = useRef(false)
  const claimQueuedRef = useRef(false)
  const requestClaimRef = useRef<() => void>(() => undefined)
  const dropsRequestRef = useRef(0)
  const userId = user?.id
  const coupleId = couple?.id
  const isReady = Boolean(userId && coupleId && pairingState === 'paired')

  const setActiveMoment = useCallback((next: AffectionMoment | null) => {
    momentRef.current = next
    if (mountedRef.current) setMoment(next)
  }, [])

  const enqueueMoments = useCallback((events: AffectionEvent[]) => {
    const senderName = partner?.display_name?.trim() || null
    for (const next of newRecipientMoments(events, displayedMomentIdsRef.current, senderName)) {
      if (!momentRef.current) setActiveMoment(next)
      else momentQueueRef.current.push(next)
    }
  }, [partner?.display_name, setActiveMoment])

  const refreshLoveDrops = useCallback(async () => {
    if (!isReady || !coupleId) return
    const requestId = ++dropsRequestRef.current
    if (mountedRef.current) setLoveDropsLoading(true)
    try {
      const next = await getLoveDrops()
      if (requestId !== dropsRequestRef.current || next.some((drop) => drop.couple_id !== coupleId || !isLoveDrop(drop))) return
      if (mountedRef.current) setLoveDrops(next)
    } finally {
      if (requestId === dropsRequestRef.current && mountedRef.current) setLoveDropsLoading(false)
    }
  }, [coupleId, isReady])

  const claimPending = useCallback(async () => {
    if (!isReady) return
    if (claimInFlightRef.current) {
      claimQueuedRef.current = true
      return
    }
    claimInFlightRef.current = true
    try {
      do {
        claimQueuedRef.current = false
        enqueueMoments(await claimPendingAffectionEvents())
      } while (claimQueuedRef.current)
    } finally {
      claimInFlightRef.current = false
    }
  }, [enqueueMoments, isReady])

  requestClaimRef.current = () => { void claimPending().catch(() => undefined) }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (session?.access_token) supabase.realtime.setAuth(session.access_token)
  }, [session?.access_token])

  useEffect(() => {
    dropsRequestRef.current += 1
    momentQueueRef.current = []
    displayedMomentIdsRef.current.clear()
    claimQueuedRef.current = false
    setActiveMoment(null)
    if (!isReady) {
      setLoveDrops([])
      setLoveDropsLoading(false)
      return
    }
    void refreshLoveDrops().catch(() => undefined)
    void claimPending().catch(() => undefined)
  }, [claimPending, isReady, refreshLoveDrops, setActiveMoment])

  useEffect(() => {
    if (!moment) return
    const duration = momentDurationMs[moment.type]
    const timer = window.setTimeout(() => {
      setActiveMoment(nextMomentFromQueue(momentQueueRef.current))
      if (!momentQueueRef.current.length) requestClaimRef.current()
    }, duration)
    return () => window.clearTimeout(timer)
  }, [moment, setActiveMoment])

  useEffect(() => {
    if (!isReady || !coupleId) return
    let disposed = false
    const reconcile = () => {
      void claimPending().catch(() => undefined)
      void refreshLoveDrops().catch(() => undefined)
    }
    const channel = supabase
      .channel(`affection-events:${coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affection_events', filter: `couple_id=eq.${coupleId}` }, reconcile)
      .subscribe((status) => { if (!disposed && status === 'SUBSCRIBED') reconcile() })
    const onVisible = () => { if (document.visibilityState === 'visible') reconcile() }
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) reconcile() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reconcile)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reconcile)
      window.removeEventListener('pageshow', onPageShow)
      void supabase.removeChannel(channel)
    }
  }, [claimPending, coupleId, isReady, refreshLoveDrops])

  const send = useCallback(async (eventType: AffectionEventType, message: string | null, clientEventId: string) => {
    if (!isReady) throw new Error('affection_requires_a_paired_couple')
    return sendAffectionEvent(eventType, message, clientEventId)
  }, [isReady])

  const sendMoment = useCallback((type: AffectionMomentType, clientEventId: string) => send(type, null, clientEventId), [send])
  const sendLoveDrop = useCallback((message: string, clientEventId: string) => send('love_drop', message, clientEventId), [send])
  const openDrop = useCallback(async (eventId: string) => {
    const opened = await openLoveDrop(eventId)
    if (mountedRef.current) setLoveDrops((current) => current.map((drop) => drop.id === opened.id ? opened : drop))
    return opened
  }, [])
  const unreadLoveDropCount = useMemo(() => loveDrops.filter((drop) => !drop.opened_at).length, [loveDrops])
  const value = useMemo<AffectionContextValue>(() => ({
    moment,
    letterDeskOpen,
    loveDrops,
    unreadLoveDropCount,
    loveDropsLoading,
    sendMoment,
    sendLoveDrop,
    openDrop,
    refreshLoveDrops,
    setLetterDeskOpen,
  }), [letterDeskOpen, loveDrops, loveDropsLoading, moment, openDrop, refreshLoveDrops, sendLoveDrop, sendMoment, unreadLoveDropCount])

  return <AffectionContext.Provider value={value}>{children}</AffectionContext.Provider>
}
