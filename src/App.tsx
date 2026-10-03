import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLoader } from './components/layout/AppLoader'

const LandingScreen = lazy(() => import('./pages/LandingScreen').then((module) => ({ default: module.LandingScreen })))
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp').then((module) => ({ default: module.AuthenticatedApp })))

export default function App() {
  return <Routes>
    <Route path="/" element={<Suspense fallback={<AppLoader />}><LandingScreen /></Suspense>} />
    <Route path="*" element={<Suspense fallback={<AppLoader />}><AuthenticatedApp /></Suspense>} />
  </Routes>
}
