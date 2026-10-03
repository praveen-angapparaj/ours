import { supabase } from '../../lib/supabase'
import { getProfileById, type Profile } from '../auth/auth-service'
import type { Couple, CoupleMember, CoupleSnapshot } from './pairing-types'

type RpcInviteResult = { couple_id: string; invite_code: string }
type CoreCouple = Omit<Couple, 'relationship_started_on' | 'couple_display_name'>
type RelationshipFields = Pick<Couple, 'relationship_started_on' | 'couple_display_name'>

function isMissingPhaseThreeColumns(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.code === '42703' || error?.code === 'PGRST204' || (message.includes('relationship_started_on') && (message.includes('does not exist') || message.includes('schema cache')))
}

function asInviteResult(data: unknown): RpcInviteResult {
  if (!Array.isArray(data) || data.length === 0) throw new Error('pairing_response_invalid')
  const first = data[0]
  if (typeof first !== 'object' || first === null || !('couple_id' in first) || !('invite_code' in first)) throw new Error('pairing_response_invalid')
  const row = first as { couple_id: unknown; invite_code: unknown }
  if (typeof row.couple_id !== 'string' || typeof row.invite_code !== 'string') throw new Error('pairing_response_invalid')
  return { couple_id: row.couple_id, invite_code: row.invite_code }
}

export function friendlyPairingError(error: Error | { message: string } | null) {
  const message = error?.message.toLowerCase() ?? ''
  if (message.includes('update_relationship_date') || message.includes('relationship_started_on')) return 'this Space needs the latest relationship database migration before the date can be saved.'
  if (message.includes('cancel_my_unpaired_couple') || message.includes('schema cache')) return 'this Space needs the latest pairing database migration before unused invites can be cancelled.'
  if (message.includes('permission denied for function') || message.includes('permission denied for table')) return 'the pairing database permissions are incomplete. Re-apply the Phase 2 migration so authenticated users can use the pairing RPCs.'
  if (message.includes('row-level security') || message.includes('does not exist')) return 'the database migration is incomplete. Apply the project migrations in order, then try again.'
  if (message.includes('authentication_required') || message.includes('jwt') || message.includes('not authenticated')) return 'your sign-in session expired. Sign in again, then enter the code.'
  if (message.includes('relationship_date_in_future')) return 'unless you are dating through time travel, pick a past date. Relationship date cannot be in the future.'
  if (message.includes('relationship_date_required')) return 'pick the day this nonsense officially began.'
  if (message.includes('couples_created_by_fkey') || message.includes('key (created_by)')) return 'this browser is still using a test account that was deleted. Reload, then create or sign in to a fresh account.'
  if (message.includes('couple_members_user_id_key') || message.includes('duplicate key') || message.includes('unique constraint')) return 'you already have a space. Reloading your existing setup now.'
  if (message.includes('couple_creation_failed')) return 'the space was almost created, but the database lost the plot. Try again once.'
  if (message.includes('invalid_invite_code')) return "nope. That code doesn't belong to any space."
  if (message.includes('invite_expired')) return 'that invitation expired. Ask your person for a new code.'
  if (message.includes('couple_full')) return 'awkward. This space already has two people.'
  if (message.includes('already_paired')) return 'you already have a person. One tiny internet universe per account.'
  if (message.includes('network') || message.includes('fetch')) return "the internet has chosen violence. We couldn't reach Our Space."
  return 'the relationship database got confused. Please try again.'
}

export async function loadCoupleSnapshot(userId: string): Promise<CoupleSnapshot> {
  const { data: memberData, error: memberError } = await supabase.from('couple_members').select('couple_id, user_id, role, joined_at').eq('user_id', userId).maybeSingle()
  if (memberError) throw memberError
  const ownMembership = memberData as CoupleMember | null
  if (!ownMembership) return { state: 'unpaired', couple: null, members: [], partner: null, error: null }
  const { data: coupleData, error: coupleError } = await supabase.from('couples').select('id, invite_code, created_by, created_at, paired_at, invite_expires_at').eq('id', ownMembership.couple_id).single()
  if (coupleError) throw coupleError
  let relationship: RelationshipFields = { relationship_started_on: null, couple_display_name: null }
  const { data: relationshipData, error: relationshipError } = await supabase.from('couples').select('relationship_started_on, couple_display_name').eq('id', ownMembership.couple_id).single()
  if (relationshipError && !isMissingPhaseThreeColumns(relationshipError)) throw relationshipError
  if (relationshipData) relationship = relationshipData as RelationshipFields
  const couple: Couple = { ...(coupleData as CoreCouple), ...relationship }
  const { data: membersData, error: membersError } = await supabase.from('couple_members').select('couple_id, user_id, role, joined_at').eq('couple_id', couple.id)
  if (membersError) throw membersError
  const members = (membersData ?? []) as CoupleMember[]
  const partnerId = members.find((member) => member.user_id !== userId)?.user_id
  let partner: Profile | null = null
  if (partnerId) {
    partner = await getProfileById(partnerId)
  }
  return { state: members.length === 2 ? 'paired' : 'waiting', couple, members, partner, error: null }
}

export async function createMyCouple() {
  const { data, error } = await supabase.rpc('create_my_couple')
  if (error) throw error
  return asInviteResult(data)
}

export async function joinCoupleByCode(code: string) {
  const { data, error } = await supabase.rpc('join_couple_by_code', { input_code: code.trim().toUpperCase() })
  if (error) throw error
  return asInviteResult(data)
}

export async function cancelMyUnpairedCouple() {
  const { error } = await supabase.rpc('cancel_my_unpaired_couple')
  if (error) throw error
}

export async function updateRelationshipDate(date: string) {
  const { data, error } = await supabase.rpc('update_relationship_date', { new_date: date })
  if (error) throw error
  return data
}
