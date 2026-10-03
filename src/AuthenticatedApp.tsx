import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/auth-provider'
import { CoupleProvider } from './features/couple/couple-provider'
import { CouplePresenceProvider } from './features/presence/presence-provider'
import { CallProvider } from './features/calls/CallProvider'
import { useCall } from './features/calls/use-call'
import { isLiveCallState } from './features/calls/types'
import { WatchProvider } from './features/watch/WatchProvider'
import { AuthRoute, PairingRoute, ProtectedRoute } from './components/layout/RouteGuards'
import { AppLoader } from './components/layout/AppLoader'

const AuthScreen = lazy(() => import('./pages/AuthScreen').then((module) => ({ default: module.AuthScreen })))
const PairingScreen = lazy(() => import('./pages/PairingScreen').then((module) => ({ default: module.PairingScreen })))
const HomeScreen = lazy(() => import('./pages/HomeScreen').then((module) => ({ default: module.HomeScreen })))
const RoomScreen = lazy(() => import('./pages/RoomScreen').then((module) => ({ default: module.RoomScreen })))
const WatchScreen = lazy(() => import('./pages/WatchScreen').then((module) => ({ default: module.WatchScreen })))
const LandingScreen = lazy(() => import('./pages/LandingScreen').then((module) => ({ default: module.LandingScreen })))
const CallOverlays = lazy(() => import('./features/calls/CallOverlays').then((module) => ({ default: module.CallOverlays })))
const CallMediaProvider = lazy(() => import('./features/calls/CallMediaProvider').then((module) => ({ default: module.CallMediaProvider })))

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
  if (!liveState || connectionError || !liveState.token || !liveState.serverUrl) return <>{children}</>
  return <Suspense fallback={<AppLoader message="keeping the call connected..." />}><CallMediaProvider>{children}</CallMediaProvider></Suspense>
}

export function AuthenticatedApp() {
  return <AuthProvider><CoupleProvider><CouplePresenceProvider><CallProvider>
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
  </CallProvider></CouplePresenceProvider></CoupleProvider></AuthProvider>
}
