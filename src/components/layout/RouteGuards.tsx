import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/use-auth'
import { useCouple } from '../../features/couple/use-couple'
import { AppLoader } from './AppLoader'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth()
  const { state } = useCouple()
  const location = useLocation()
  if (configError) return <ConfigProblem />
  if (loading || state === 'loading') return <AppLoader />
  if (!user) return <Navigate to="/auth/signin" replace state={{ from: location.pathname }} />
  if (state !== 'paired') return <Navigate to="/pair" replace />
  return <>{children}</>
}

export function PairingRoute({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth()
  const { state } = useCouple()
  if (configError) return <ConfigProblem />
  if (loading || state === 'loading') return <AppLoader message="consulting the relationship database..." />
  if (!user) return <Navigate to="/auth/signin" replace />
  return <>{children}</>
}

export function AuthRoute({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth()
  const { state } = useCouple()
  if (configError) return <ConfigProblem />
  if (loading || (user && state === 'loading')) return <AppLoader message="checking if you're allowed in..." />
  if (user) return <Navigate to={state === 'paired' ? '/home' : '/pair'} replace />
  return <>{children}</>
}

function ConfigProblem() {
  const { configError } = useAuth()
  return <main className="config-problem page-shell"><div className="config-card"><p className="eyebrow">developer heads up</p><h1>the wiring is missing.</h1><p>{configError}</p></div></main>
}
