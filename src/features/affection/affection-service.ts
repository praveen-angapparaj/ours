import { supabase } from '../../lib/supabase'
import { isAffectionEvent, type AffectionEvent, type AffectionEventType } from './affection-types'

function asEvent(value: unknown): AffectionEvent {
  const row = Array.isArray(value) ? value[0] : value
  if (!isAffectionEvent(row)) throw new Error('affection_event_response_invalid')
  return row
}

function asEvents(value: unknown) {
  if (!Array.isArray(value) || !value.every(isAffectionEvent)) throw new Error('affection_event_response_invalid')
  return value
}

export function newAffectionClientEventId() {
  const cryptoApi = typeof globalThis === 'undefined' ? undefined : globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  const bytes = new Uint8Array(16)
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') cryptoApi.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function sendAffectionEvent(eventType: AffectionEventType, message: string | null, clientEventId: string) {
  const { data, error } = await supabase.rpc('send_affection_event', {
    requested_event_type: eventType,
    requested_message: message,
    requested_client_event_id: clientEventId,
  })
  if (error) throw new Error(error.message)
  return asEvent(data)
}

export async function claimPendingAffectionEvents() {
  const { data, error } = await supabase.rpc('claim_pending_affection_events')
  if (error) throw new Error(error.message)
  return asEvents(data ?? [])
}

export async function getLoveDrops() {
  const { data, error } = await supabase.rpc('get_love_drops')
  if (error) throw new Error(error.message)
  return asEvents(data ?? [])
}

export async function openLoveDrop(eventId: string) {
  const { data, error } = await supabase.rpc('open_love_drop', { target_event_id: eventId })
  if (error) throw new Error(error.message)
  return asEvent(data)
}

export function friendlyAffectionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('affection_rate_limited')) return 'Give that little moment a second to land.'
  if (message.includes('invalid_love_drop_message')) return 'Write a note between 1 and 280 characters.'
  if (message.includes('relationship_no_longer_active') || message.includes('couple_not_found') || message.includes('partner_not_found')) return 'This moment needs an active shared space.'
  if (message.includes('unauthorized')) return 'That note belongs to the other side of your shared space.'
  if (message.includes('network') || message.includes('fetch')) return 'This could not be sent right now. Keep it and try again.'
  return 'This little moment could not be saved yet. Try again.'
}
