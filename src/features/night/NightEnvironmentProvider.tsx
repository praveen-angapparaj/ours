import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useCall } from '../calls/use-call'
import { isLiveCallState, type CallRuntimeState } from '../calls/types'
import { SharedNightEnvironment, type NightVisualState } from './SharedNightEnvironment'

type WatchNightActivity = { active: boolean; hasMedia: boolean; playbackState: 'empty' | 'paused' | 'playing' | 'ended' }
type NightEnvironmentContextValue = { setRemoteCameraActive: (active: boolean) => void; setWatchActivity: (activity: WatchNightActivity) => void }

const emptyWatchActivity: WatchNightActivity = { active: false, hasMedia: false, playbackState: 'empty' }
const NightEnvironmentContext = createContext<NightEnvironmentContextValue | null>(null)

function deriveVisualState(call: CallRuntimeState, watch: WatchNightActivity, remoteCameraActive: boolean, reducedMotion: boolean): NightVisualState {
  const ringing = call.status === 'creating' || call.status === 'outgoing-ringing' || call.status === 'incoming-ringing' || call.status === 'accepting'
  const live = isLiveCallState(call)
  const callType = live ? call.call.call_type : ('call' in call ? call.call.call_type : null)
  const hasRemoteCamera = live && callType === 'video' && remoteCameraActive
  const active = ringing || live || watch.active

  let mode: NightVisualState['mode'] = 'idle'
  let moonPhase = .72
  let moonBrightness = .48

  if (watch.active) {
    mode = hasRemoteCamera ? 'watch-with-call' : watch.playbackState === 'playing' ? 'watch-playing' : watch.hasMedia ? 'watch-paused' : 'watch-idle'
    moonPhase = hasRemoteCamera ? 1 : watch.hasMedia ? .78 : .7
    moonBrightness = hasRemoteCamera ? (watch.playbackState === 'playing' ? .7 : .78) : watch.playbackState === 'playing' ? .42 : .56
  } else if (ringing) {
    mode = 'call-ringing'
    moonPhase = .22
    moonBrightness = call.status === 'incoming-ringing' ? .42 : .34
  } else if (live) {
    mode = 'call-connected'
    moonPhase = hasRemoteCamera ? 1 : callType === 'video' ? .76 : .73
    moonBrightness = hasRemoteCamera ? 1 : call.status === 'connecting' ? .52 : .67
  }

  return { active, mode, moonPhase, moonBrightness, remoteCameraActive: hasRemoteCamera, reducedMotion }
}

export function NightEnvironmentProvider({ children }: { children: ReactNode }) {
  const { state: callState } = useCall()
  const reducedMotion = useReducedMotion()
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === 'visible')
  const [remoteCameraActive, setRemoteCameraActive] = useState(false)
  const [watchActivity, setWatchActivity] = useState<WatchNightActivity>(emptyWatchActivity)
  const visualState = useMemo(() => deriveVisualState(callState, watchActivity, remoteCameraActive, reducedMotion || !pageVisible), [callState, pageVisible, reducedMotion, remoteCameraActive, watchActivity])

  useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  useEffect(() => {
    if (!isLiveCallState(callState) || callState.call.call_type !== 'video') setRemoteCameraActive(false)
  }, [callState])

  const value = useMemo<NightEnvironmentContextValue>(() => ({ setRemoteCameraActive, setWatchActivity }), [])
  const contentClass = `night-environment-content${visualState.active ? ' is-night-active' : ''} is-${visualState.mode}`

  return <NightEnvironmentContext.Provider value={value}>
    <SharedNightEnvironment state={visualState} />
    <div className={contentClass}>{children}</div>
  </NightEnvironmentContext.Provider>
}

export function useNightEnvironment() {
  const context = useContext(NightEnvironmentContext)
  if (!context) throw new Error('useNightEnvironment must be used inside NightEnvironmentProvider')
  return context
}
