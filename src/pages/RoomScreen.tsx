import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Orbit, Radio } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartnerPresence } from '../components/home/PartnerPresence'
import { FloatingReaction, type Reaction } from '../components/FloatingReaction'
import { CallControls } from '../components/room/CallControls'
import { ParticipantCard } from '../components/room/ParticipantCard'
import { ReactionTray, type ReactionKind } from '../components/room/ReactionTray'
import { RoomCanvas } from '../components/room/RoomCanvas'
import { useCouple } from '../features/couple/use-couple'
import { profileInitials } from '../features/couple/profile-initials'
import { useCouplePresence } from '../features/presence/use-couple-presence'
import type { PartnerPresenceStatus } from '../features/presence/presence-types'
import { useCall } from '../features/calls/use-call'
import { isLiveCallState, type LiveCallRuntimeState } from '../features/calls/types'
import { useCallMediaReady } from '../features/calls/call-media-state'

const LiveAudioCallRoom = lazy(() => import('../features/calls/LiveAudioCallRoom').then((module) => ({ default: module.LiveAudioCallRoom })))
const LiveVideoCallRoom = lazy(() => import('../features/calls/LiveVideoCallRoom').then((module) => ({ default: module.LiveVideoCallRoom })))

type BaseRoomContentProps = {
  localMicOn: boolean
  localCameraOn: boolean
  mediaAvailable: boolean
  onMicToggle: () => void
  onCameraToggle: () => void
}

function BaseRoomContent({ localMicOn, localCameraOn, mediaAvailable, onMicToggle, onCameraToggle }: BaseRoomContentProps) {
  const navigate = useNavigate()
  const { partner } = useCouple()
  const { partnerStatus, hydrated } = useCouplePresence()
  const { startCall } = useCall()
  const partnerName = partner?.display_name ?? 'your person'
  const partnerInitial = profileInitials(partnerName, 'M')
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [filtersOn, setFiltersOn] = useState(false)
  const [reactionsOpen, setReactionsOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const [roomNote, setRoomNote] = useState(`waiting for ${partnerName} at the observatory`)
  const previousStatus = useRef<PartnerPresenceStatus | null>(null)
  const noteTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(noteTimer.current), [])
  useEffect(() => {
    if (!hydrated || !partner) return
    const previous = previousStatus.current
    previousStatus.current = partnerStatus
    if (!previous) { setRoomNote(partnerStatus === 'in_room' ? `${partnerName} is here` : `waiting for ${partnerName} at the observatory`); return }
    if (previous !== 'in_room' && partnerStatus === 'in_room') { setRoomNote(`${partnerName} just arrived`); return }
    if (previous === 'in_room' && partnerStatus !== 'in_room') {
      const fallback = partnerStatus === 'online' ? `${partnerName} is online — send a signal` : `waiting for ${partnerName} at the observatory`
      setRoomNote(partnerStatus === 'online' ? `${partnerName} stepped away` : 'the observatory is quiet again')
      window.clearTimeout(noteTimer.current)
      noteTimer.current = window.setTimeout(() => setRoomNote(fallback), 2_800)
      return
    }
    if (partnerStatus === 'offline') setRoomNote(`${partnerName} is offline — the light stays on`)
  }, [hydrated, partner, partnerName, partnerStatus])

  const sendReaction = (kind: ReactionKind, symbol: string) => {
    const reaction: Reaction = { id: Date.now() + Math.random(), kind, symbol, x: Math.round((Math.random() - 0.5) * 140), rotation: kind === 'tomato' ? 305 : Math.round((Math.random() - 0.5) * 40) }
    setReactions((current) => [...current.slice(-7), reaction])
  }

  return <main className="room-page page-shell room-observatory">
    <header className="room-header">
      <button className="back-button" onClick={() => navigate('/home')} aria-label="Return to your shared orbit"><ArrowLeft size={18} /> <span>return to orbit</span></button>
      <div className="room-name room-observatory-name"><span className="room-live-dot" aria-hidden="true" /><Orbit size={14} aria-hidden="true" /><span>shared observatory</span></div>
      <div className="room-status"><PartnerPresence compact status={partnerStatus} name={partnerName} onJoin={() => navigate('/room')} onCall={() => void startCall()} /></div>
    </header>
    <AnimatePresence mode="wait"><motion.p key={roomNote} className="room-presence-note" role="status" aria-live="polite" initial={{ opacity: 0, y: -5, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 1 }} exit={{ opacity: 0, y: 4 }}><Radio className="room-presence-note-icon" size={12} aria-hidden="true" /><span>{roomNote}</span></motion.p></AnimatePresence>
    <section className="room-stage room-observatory-stage" aria-label="Shared observatory">
      <RoomCanvas mode="empty" onMediaSelect={(kind) => navigate(kind === 'music' ? '/watch?category=music' : '/watch')} />
      <ParticipantCard name={partnerName} label={partnerStatus === 'in_room' ? 'IN THE OBSERVATORY' : 'THEIR WINDOW'} avatar={partnerInitial} cameraEnabled={false} microphoneEnabled={false} isSpeaking={false} connectionState="good" variant="coral" isSelf={false} />
      <ParticipantCard name="You" label="YOUR WINDOW" avatar="Y" cameraEnabled={localCameraOn} microphoneEnabled={localMicOn} isSpeaking={false} connectionState="good" variant="blue" isSelf filtersEnabled={filtersOn} />
    </section>
    <ReactionTray open={reactionsOpen} onReaction={sendReaction} />
    <CallControls micOn={localMicOn} cameraOn={localCameraOn} filtersOn={filtersOn} reactionsOpen={reactionsOpen} mediaOpen={false} mediaUnavailable={!mediaAvailable} onMic={onMicToggle} onCamera={onCameraToggle} onReactions={() => setReactionsOpen((current) => !current)} onFilters={() => setFiltersOn((current) => !current)} onMedia={() => navigate('/watch')} onHangup={() => navigate('/home')} />
    <AnimatePresence>{reactions.map((reaction) => <FloatingReaction key={reaction.id} reaction={reaction} onDone={(id) => setReactions((current) => current.filter((item) => item.id !== id))} />)}</AnimatePresence>
  </main>
}

function IdleRoomContent() {
  return <BaseRoomContent
    localMicOn={false}
    localCameraOn={false}
    mediaAvailable={false}
    onMicToggle={() => undefined}
    onCameraToggle={() => undefined}
  />
}

function CallConnecting({ call, error }: { call: LiveCallRuntimeState['call'], error?: string }) {
  const { endCall, retryConnection } = useCall()
  return <main className="call-connecting page-shell">
    <section className="call-connecting-card">
      <p className="eyebrow">{call.call_type} call</p>
      <h1>{error ?? 'getting the tiny wires connected...'}</h1>
      <p>{error ? 'you can try again without ending the call.' : call.call_type === 'video' ? 'your microphone and camera only wake up once this part is ready.' : 'your microphone will only wake up once this part is ready.'}</p>
      <div className="call-problem-actions"><button className="animated-button tone-yellow" onClick={retryConnection}>TRY AGAIN</button><button className="animated-button tone-coral" onClick={() => void endCall()}>END CALL</button></div>
      <small>call #{call.id.slice(0, 8)}</small>
    </section>
  </main>
}

export function RoomScreen() {
  const navigate = useNavigate()
  const { state } = useCall()
  const mediaReady = useCallMediaReady()
  const wasLiveCall = useRef(false)
  const liveState = isLiveCallState(state) ? state : null

  useEffect(() => {
    if (liveState) {
      wasLiveCall.current = true
      return
    }
    if (wasLiveCall.current) {
      wasLiveCall.current = false
      navigate('/home', { replace: true })
    }
  }, [liveState, navigate])

  if (liveState) {
    const connectionError = liveState.status === 'connecting' ? liveState.connectionError : undefined
    if (connectionError || !liveState.token || !liveState.serverUrl || !mediaReady) return <CallConnecting call={liveState.call} error={connectionError} />
    return <Suspense fallback={<CallConnecting call={liveState.call} />}>{liveState.call.call_type === 'video' ? <LiveVideoCallRoom session={liveState} /> : <LiveAudioCallRoom session={liveState} />}</Suspense>
  }
  return <IdleRoomContent />
}
