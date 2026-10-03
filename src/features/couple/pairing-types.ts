import type { Profile } from '../auth/auth-service'

export type Couple = { id: string; invite_code: string; created_by: string; created_at: string; paired_at: string | null; invite_expires_at: string | null; relationship_started_on: string | null; couple_display_name: string | null }
export type CoupleMember = { couple_id: string; user_id: string; role: 'creator' | 'partner'; joined_at: string }
export type PairingState = 'loading' | 'unpaired' | 'waiting' | 'paired' | 'error'
export type CoupleSnapshot = { state: PairingState; couple: Couple | null; members: CoupleMember[]; partner: Profile | null; error: string | null }
