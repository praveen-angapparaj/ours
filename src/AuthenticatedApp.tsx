import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/auth-provider'
import { CoupleProvider } from './features/couple/couple-provider'
import { CouplePresenceProvider } from './features/presence/presence-provider'
import { CallProvider } from './features/calls/CallProvider'
import { useCall } from './features/calls/use-call'
import { AuthRoute, PairingRoute, ProtectedRoute } from './components/layout/RouteGuards'
import { AppLoader } from './components/layout/AppLoader'

const AuthScreen = lazy(() => import('./pages/AuthScreen').then((module) => ({ default: module.AuthScreen })))
const PairingScreen = lazy(() => import('./pages/PairingScreen').then((module) => ({ default: module.PairingScreen })))
const HomeScreen = lazy(() => import('./pages/HomeScreen').then((module) => ({ default: module.HomeScreen })))
const RoomScreen = lazy(() => import('./pages/RoomScreen').then((module) => ({ default: module.RoomScreen })))
const LandingScreen = lazy(() => import('./pages/LandingScreen').then((module) => ({ default: module.LandingScreen })))
const CallOverlays = lazy(() => import('./features/calls/CallOverlays').then((module) => ({ default: module.CallOverlays })))

function ScreenLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppLoader />}>{children}</Suspense>
}

function CallOverlayBoundary() {
  const { state, notice } = useCall()
  if (state.status === 'idle' && !notice) return null
  return <Suspense fallback={null}><CallOverlays /></Suspense>
}

export function AuthenticatedApp() {
  return <AuthProvider><CoupleProvider><CouplePresenceProvider><CallProvider>
    <Routes>
      <Route path="/auth" element={<AuthRoute><ScreenLoader><AuthScreen key="signup" mode="signup" /></ScreenLoader></AuthRoute>} />
      <Route path="/auth/signup" element={<AuthRoute><ScreenLoader><AuthScreen key="signup" mode="signup" /></ScreenLoader></AuthRoute>} />
      <Route path="/auth/signin" element={<AuthRoute><ScreenLoader><AuthScreen key="signin" mode="signin" /></ScreenLoader></AuthRoute>} />
      <Route path="/pair" element={<PairingRoute><ScreenLoader><PairingScreen /></ScreenLoader></PairingRoute>} />
      <Route path="/home" element={<ProtectedRoute><ScreenLoader><HomeScreen /></ScreenLoader></ProtectedRoute>} />
      <Route path="/room" element={<ProtectedRoute><Suspense fallback={<AppLoader message="setting up the room..." />}><RoomScreen /></Suspense></ProtectedRoute>} />
      <Route path="*" element={<ScreenLoader><LandingScreen /></ScreenLoader>} />
    </Routes>
    <CallOverlayBoundary />
  </CallProvider></CouplePresenceProvider></CoupleProvider></AuthProvider>
}
