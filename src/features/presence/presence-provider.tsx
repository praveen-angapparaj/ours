import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/use-auth'
import { useCouple } from '../couple/use-couple'
import { supabase } from '../../lib/supabase'
import type { CouplePresencePayload, PartnerPresenceStatus, PresenceConnectionState, PresenceRoute } from './presence-types'

type CouplePresenceContextValue = {
  partnerStatus: PartnerPresenceStatus
  partnerIsOnline: boolean
  partnerIsInRoom: boolean
  partnerPresenceEntries: CouplePresencePayload[]
  myStatus: CouplePresencePayload['status']
  connectionState: PresenceConnectionState
  hydrated: boolean
}

const defaultContext: CouplePresenceContextValue = { partnerStatus: 'unknown', partnerIsOnline: false, partnerIsInRoom: false, partnerPresenceEntries: [], myStatus: 'online', connectionState: 'disconnected', hydrated: false }
export const CouplePresenceContext = createContext<CouplePresenceContextValue>(defaultContext)

function newClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function isPresencePayload(value: unknown): value is CouplePresencePayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  return typeof payload.userId === 'string' && typeof payload.displayName === 'string' && typeof payload.clientId === 'string' && typeof payload.connectedAt === 'string' && (payload.status === 'online' || payload.status === 'away' || payload.status === 'in_room') && (payload.route === 'home' || payload.route === 'room' || payload.route === 'other')
}

function routeFor(pathname: string): PresenceRoute {
  if (pathname === '/room') return 'room'
  if (pathname === '/home') return 'home'
  return 'other'
}

function derivePartnerStatus(entries: CouplePresencePayload[], connected: boolean, hydrated: boolean): PartnerPresenceStatus {
  if (!connected || !hydrated) return 'unknown'
  if (entries.some((entry) => entry.status === 'in_room')) return 'in_room'
  if (entries.some((entry) => entry.status === 'online')) return 'online'
  if (entries.some((entry) => entry.status === 'away')) return 'away'
  return 'offline'
}

export function CouplePresenceProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { user, session, profile } = useAuth()
  const { couple, partner, state: pairingState } = useCouple()
  const [clientId] = useState(newClientId)
  const [entries, setEntries] = useState<CouplePresencePayload[]>([])
  const [connectionState, setConnectionState] = useState<PresenceConnectionState>('disconnected')
  const [hydrated, setHydrated] = useState(false)
  const [away, setAway] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const connectedRef = useRef(false)
  const route = routeFor(location.pathname)
  const myStatus: CouplePresencePayload['status'] = away ? 'away' : route === 'room' ? 'in_room' : 'online'
  const trackPresence = useCallback(() => {
    if (!user || !connectedRef.current || !channelRef.current) return
    void channelRef.current.track({ userId: user.id, displayName: profile?.display_name || 'Troublemaker', status: myStatus, route, connectedAt: new Date().toISOString(), clientId })
  }, [user, profile?.display_name, myStatus, route, clientId])
  const trackPresenceRef = useRef(trackPresence)
  useEffect(() => { trackPresenceRef.current = trackPresence }, [trackPresence])

  useEffect(() => {
    if (session?.access_token) supabase.realtime.setAuth(session.access_token)
  }, [session?.access_token])
  useEffect(() => {
    let awayTimer: number | undefined
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') { window.clearTimeout(awayTimer); setAway(false); return }
      awayTimer = window.setTimeout(() => { if (document.visibilityState !== 'visible') setAway(true) }, 45_000)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => { window.clearTimeout(awayTimer); document.removeEventListener('visibilitychange', onVisibilityChange) }
  }, [])
  useEffect(() => { trackPresence() }, [trackPresence])
  useEffect(() => {
    if (!user || !couple || pairingState !== 'paired') {
      setEntries([]); setHydrated(false); setConnectionState('disconnected'); return
    }
    const topic = `couple:${couple.id}:presence`
    setEntries([]); setHydrated(false); setConnectionState('connecting'); connectedRef.current = false
    const syncPresence = () => {
      const raw = channel.presenceState() as Record<string, unknown[]>
      setEntries(Object.values(raw).flat().filter(isPresencePayload)); setHydrated(true)
    }
    const channel = supabase.channel(topic, { config: { private: true, presence: { key: clientId } } })
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
    channelRef.current = channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { connectedRef.current = true; setConnectionState('connected'); trackPresenceRef.current(); return }
      if (status === 'CHANNEL_ERROR') { connectedRef.current = false; setHydrated(false); setConnectionState('error'); return }
      if (status === 'TIMED_OUT') { connectedRef.current = false; setHydrated(false); setConnectionState('reconnecting'); return }
      if (status === 'CLOSED') { connectedRef.current = false; setHydrated(false); setConnectionState('disconnected') }
    })
    return () => { connectedRef.current = false; channelRef.current = null; void supabase.removeChannel(channel) }
  }, [user, couple?.id, pairingState, clientId])

  const partnerEntries = useMemo(() => entries.filter((entry) => entry.userId === partner?.id), [entries, partner?.id])
  const partnerStatus = derivePartnerStatus(partnerEntries, connectionState === 'connected', hydrated)
  const value = useMemo<CouplePresenceContextValue>(() => ({ partnerStatus, partnerIsOnline: partnerStatus === 'online' || partnerStatus === 'in_room' || partnerStatus === 'away', partnerIsInRoom: partnerStatus === 'in_room', partnerPresenceEntries: partnerEntries, myStatus, connectionState, hydrated }), [partnerStatus, partnerEntries, myStatus, connectionState, hydrated])
  return <CouplePresenceContext.Provider value={value}>{children}</CouplePresenceContext.Provider>
}
