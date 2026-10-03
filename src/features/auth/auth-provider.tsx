import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, supabaseConfigError } from '../../lib/supabase'
import { friendlyAuthError, getMyProfile, signInWithPassword, signUpWithPassword, type AuthResult, type Profile, updateMyProfile } from './auth-service'
import type { PronounSet } from './pronouns'

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  configError: string | null
  signUp: (displayName: string, email: string, password: string, pronounSet: PronounSet) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (displayName: string, avatarUrl: string, pronounSet: PronounSet) => Promise<void>
  refreshProfile: () => Promise<void>
  retry: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function retainStableUser(previous: Session | null, next: Session | null, event?: string) {
  if (!previous || !next || event === 'USER_UPDATED' || previous.user.id !== next.user.id) return next
  // Supabase replaces the session (and user object) during TOKEN_REFRESHED.
  // Keep the user reference stable so downstream providers do not mistake a
  // routine token rotation for a new application session.
  return { ...next, user: previous.user }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const user = session?.user ?? null
  const refreshProfile = useCallback(async () => {
    if (!user) { setProfile(null); return }
    const nextProfile = await getMyProfile(user.id)
    if (!nextProfile) {
      // A profile row can briefly be unavailable immediately after sign-up or
      // during a database refresh. A missing row is not proof that the
      // authenticated account was deleted, so retain the valid auth session.
      setProfile(null)
      return
    }
    setProfile(nextProfile)
  }, [user])
  const initialize = useCallback(async () => {
    if (supabaseConfigError) { setLoading(false); return }
    setError(null)
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) setError(friendlyAuthError(sessionError))
    setSession((current) => retainStableUser(current, data.session))
    setLoading(false)
  }, [])
  useEffect(() => {
    void initialize()
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession((current) => retainStableUser(current, nextSession, event))
      // The initial session is the only auth event allowed to control the
      // full-screen hydration gate. TOKEN_REFRESHED must be invisible.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') setLoading(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [initialize])
  useEffect(() => { if (!user) { setProfile(null); return }; void refreshProfile().catch((profileError: Error) => setError(friendlyAuthError(profileError))) }, [user, refreshProfile])
  const signUp = useCallback(async (displayName: string, email: string, password: string, pronounSet: PronounSet) => signUpWithPassword(displayName, email, password, pronounSet), [])
  const signIn = useCallback(async (email: string, password: string) => { const { session: nextSession } = await signInWithPassword(email, password); setSession(nextSession) }, [])
  const signOut = useCallback(async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) throw signOutError; setSession(null); setProfile(null) }, [])
  const updateProfile = useCallback(async (displayName: string, avatarUrl: string, pronounSet: PronounSet) => { if (!user) throw new Error('Not signed in'); const nextProfile = await updateMyProfile(user.id, { display_name: displayName.trim() || 'Troublemaker', avatar_url: avatarUrl.trim() || null, pronoun_set: pronounSet }); setProfile(nextProfile) }, [user])
  const value = useMemo<AuthContextValue>(() => ({ user, session, profile, loading, error, configError: supabaseConfigError, signUp, signIn, signOut, updateProfile, refreshProfile, retry: initialize }), [user, session, profile, loading, error, signUp, signIn, signOut, updateProfile, refreshProfile, initialize])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
