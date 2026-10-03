import type { AuthError, Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { asPronounSet, type PronounSet } from './pronouns'

export type Profile = { id: string; display_name: string; avatar_url: string | null; pronoun_set: PronounSet; created_at: string; updated_at: string }
export type AuthResult = { session: Session | null; user: User | null; requiresEmailConfirmation: boolean }
type CoreProfile = Omit<Profile, 'pronoun_set'>

function isMissingPronounColumn(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.code === '42703' || error?.code === 'PGRST204' || (message.includes('pronoun_set') && (message.includes('does not exist') || message.includes('schema cache')))
}

export function friendlyAuthError(error: AuthError | Error | null) {
  const message = error?.message.toLowerCase() ?? ''
  if (message.includes('invalid login credentials')) return "those credentials aren't credentialing. Check your email and password."
  if (message.includes('already registered') || message.includes('already been registered')) return 'that email already lives here. Try signing in instead.'
  if (message.includes('account_was_deleted')) return 'this browser remembered an account that was deleted during the test reset. Please create or sign in to a fresh account.'
  if (message.includes('password should be at least') || message.includes('weak password')) return 'give that password a little more personality - use at least 8 characters.'
  if (message.includes('rate limit') || message.includes('too many requests')) return 'the paperwork desk is overwhelmed. Please wait a minute and try again.'
  if (message.includes('network') || message.includes('fetch')) return "the internet has chosen violence. We couldn't reach Our Space."
  return 'something went sideways while checking your credentials. Please try again.'
}

export async function signUpWithPassword(displayName: string, email: string, password: string, pronounSet: PronounSet): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim(), pronoun_set: pronounSet } } })
  if (error) throw error
  return { session: data.session, user: data.user, requiresEmailConfirmation: !data.session && Boolean(data.user) }
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function getProfileById(userId: string) {
  const fullProfile = await supabase.from('profiles').select('id, display_name, avatar_url, created_at, updated_at, pronoun_set').eq('id', userId).maybeSingle()
  if (!fullProfile.error) {
    if (!fullProfile.data) return null
    return { ...(fullProfile.data as CoreProfile), pronoun_set: asPronounSet((fullProfile.data as { pronoun_set: string | null }).pronoun_set) } as Profile
  }
  if (!isMissingPronounColumn(fullProfile.error)) throw fullProfile.error

  // Keep existing installations usable while their database cache catches up
  // with the pronoun migration, without making every normal profile read do
  // two round trips.
  const fallback = await supabase.from('profiles').select('id, display_name, avatar_url, created_at, updated_at').eq('id', userId).maybeSingle()
  if (fallback.error) throw fallback.error
  return fallback.data ? { ...(fallback.data as CoreProfile), pronoun_set: 'they_them' } as Profile : null
}

export async function getMyProfile(userId: string) {
  return getProfileById(userId)
}

export async function updateMyProfile(userId: string, updates: Pick<Profile, 'display_name' | 'avatar_url' | 'pronoun_set'>) {
  const fullUpdate = { ...updates, pronoun_set: asPronounSet(updates.pronoun_set) }
  let { data, error } = await supabase.from('profiles').update(fullUpdate).eq('id', userId).select('id, display_name, avatar_url, created_at, updated_at, pronoun_set').single()
  if (error && isMissingPronounColumn(error)) {
    const fallback = await supabase.from('profiles').update({ display_name: updates.display_name, avatar_url: updates.avatar_url }).eq('id', userId).select('id, display_name, avatar_url, created_at, updated_at').single()
    if (fallback.error) throw fallback.error
    return { ...(fallback.data as CoreProfile), pronoun_set: 'they_them' } as Profile
  }
  if (error) throw error
  return { ...(data as Omit<Profile, 'pronoun_set'>), pronoun_set: asPronounSet((data as { pronoun_set: string | null }).pronoun_set) } as Profile
}
