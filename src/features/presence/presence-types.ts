export type PartnerPresenceStatus = 'online' | 'away' | 'in_room' | 'offline' | 'unknown'
export type PresenceConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
export type PresenceRoute = 'home' | 'room' | 'other'
export type CouplePresencePayload = {
  userId: string
  displayName: string
  status: Exclude<PartnerPresenceStatus, 'offline' | 'unknown'>
  route: PresenceRoute
  connectedAt: string
  clientId: string
}
