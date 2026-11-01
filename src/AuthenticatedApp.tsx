import { lazy, Suspense, useCallback, useEffect, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './features/auth/auth-provider'
import { useAuth } from './features/auth/use-auth'
import { CoupleProvider } from './features/couple/couple-provider'
import { useCouple } from './features/couple/use-couple'
import { CouplePresenceProvider } from './features/presence/presence-provider'
import { CallProvider } from './features/calls/CallProvider'
import { NightEnvironmentProvider } from './features/night/NightEnvironmentProvider'
import { useCall } from './features/calls/use-call'
import { isLiveCallState } from './features/calls/types'
import { WatchProvider } from './features/watch/WatchProvider'
import { AffectionProvider } from './features/affection/AffectionProvider'
import { CallMediaReadyProvider } from './features/calls/call-media-state'
import { loadCallMediaProvider } from './features/calls/call-media-loader'
import { AuthRoute, PairingRoute, ProtectedRoute } from './components/layout/RouteGuards'
import { AppLoader } from './components/layout/AppLoader'

const AuthScreen = lazy(() => import('./pages/AuthScreen').then((module) => ({ default: module.AuthScreen })))
const PairingScreen = lazy(() => import('./pages/PairingScreen').then((module) => ({ default: module.PairingScreen })))
const HomeScreen = lazy(() => import('./pages/HomeScreen').then((module) => ({ default: module.HomeScreen })))
const RoomScreen = lazy(() => import('./pages/RoomScreen').then((module) => ({ default: module.RoomScreen })))
const WatchScreen = lazy(() => import('./pages/WatchScreen').then((module) => ({ default: module.WatchScreen })))
const LandingScreen = lazy(() => import('./pages/LandingScreen').then((module) => ({ default: module.LandingScreen })))
const CallOverlays = lazy(() => import('./features/calls/CallOverlays').then((module) => ({ default: module.CallOverlays })))
const CallMediaProvider = lazy(() => loadCallMediaProvider().then((module) => ({ default: module.CallMediaProvider })))

function ScreenLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppLoader />}>{children}</Suspense>
}

function CallOverlayBoundary() {
  const { state, notice } = useCall()
  if (state.status === 'idle' && !notice) return null
  return <Suspense fallback={null}><CallOverlays /></Suspense>
}

function CallMediaBoundary({ children }: { children: ReactNode }) {
  const { state } = useCall()
  const liveState = isLiveCallState(state) ? state : null
  const connectionError = liveState?.status === 'connecting' ? liveState.connectionError : undefined
  if (!liveState || connectionError || !liveState.token || !liveState.serverUrl) {
    return <CallMediaReadyProvider ready={false}>{children}</CallMediaReadyProvider>
  }

  // The fallback intentionally preserves the currently visible route. A small
  // readiness context lets call-aware screens keep their connecting UI until
  // LiveKit has loaded instead of blanking the entire application.
  return <Suspense fallback={<CallMediaReadyProvider ready={false}>{children}</CallMediaReadyProvider>}>
    <CallMediaProvider>{children}</CallMediaProvider>
  </Suspense>
}

// A small per-tab recovery hint for an actual browser discard. BrowserRouter
// already preserves the URL; this records enough context to validate and
// silently recover live state without ever persisting credentials or media.
function ContinuitySnapshot() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { couple, state: pairingState } = useCouple()
  const { state: callState } = useCall()
  const persist = useCallback(() => {
    if (loading) return
    try {
      if (!user) { window.sessionStorage.removeItem('our-space:continuity:v1'); return }
      const activeCallId = 'call' in callState ? callState.call.id : null
      window.sessionStorage.setItem('our-space:continuity:v1', JSON.stringify({
        version: 1,
        route: location.pathname,
        activeFeature: location.pathname === '/watch' ? 'watch' : activeCallId ? 'call' : 'app',
        coupleId: couple?.id ?? null,
        activeCallId,
        pairingState,
        updatedAt: Date.now(),
      }))
    } catch {
      // Storage can be unavailable in privacy modes. Live continuity still works.
    }
  }, [callState, couple?.id, loading, location.pathname, pairingState, user])

  useEffect(() => {
    persist()
    window.addEventListener('pagehide', persist)
    return () => window.removeEventListener('pagehide', persist)
  }, [persist])

  return null
}

export function AuthenticatedApp() {
  return <AuthProvider><CoupleProvider><CouplePresenceProvider><CallProvider><AffectionProvider>
    <NightEnvironmentProvider>
      <ContinuitySnapshot />
      <CallMediaBoundary>
        <Routes>
          <Route path="/auth" element={<AuthRoute><ScreenLoader><AuthScreen key="signup" mode="signup" /></ScreenLoader></AuthRoute>} />
          <Route path="/auth/signup" element={<AuthRoute><ScreenLoader><AuthScreen key="signup" mode="signup" /></ScreenLoader></AuthRoute>} />
          <Route path="/auth/signin" element={<AuthRoute><ScreenLoader><AuthScreen key="signin" mode="signin" /></ScreenLoader></AuthRoute>} />
          <Route path="/pair" element={<PairingRoute><ScreenLoader><PairingScreen /></ScreenLoader></PairingRoute>} />
          <Route path="/home" element={<ProtectedRoute><ScreenLoader><HomeScreen /></ScreenLoader></ProtectedRoute>} />
          <Route path="/room" element={<ProtectedRoute><Suspense fallback={<AppLoader message="setting up the room..." />}><RoomScreen /></Suspense></ProtectedRoute>} />
          <Route path="/watch" element={<ProtectedRoute><WatchProvider><Suspense fallback={<AppLoader message="warming up the shared television..." />}><WatchScreen /></Suspense></WatchProvider></ProtectedRoute>} />
          <Route path="*" element={<ScreenLoader><LandingScreen /></ScreenLoader>} />
        </Routes>
        <CallOverlayBoundary />
      </CallMediaBoundary>
    </NightEnvironmentProvider>
  </AffectionProvider></CallProvider></CouplePresenceProvider></CoupleProvider></AuthProvider>
}
