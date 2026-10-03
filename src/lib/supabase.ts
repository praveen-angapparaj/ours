import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError = !url || !publishableKey
  ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and provide both values.'
  : null

export const supabase = createClient(
  url ?? 'https://missing-supabase-url.invalid',
  publishableKey ?? 'missing-publishable-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
