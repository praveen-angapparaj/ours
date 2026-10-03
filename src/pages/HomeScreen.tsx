import { AnimatePresence, motion } from 'motion/react'
import { Camera, Phone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnnoyButton } from '../components/home/AnnoyButton'
import { SharedSpaceScene } from '../components/home/SharedSpaceScene'
import { TogetherCounter } from '../components/home/TogetherCounter'
import { UserMenu } from '../components/home/UserMenu'
import { PageTransition } from '../components/PageTransition'
import { useCouple } from '../features/couple/use-couple'
import { useCouplePresence } from '../features/presence/use-couple-presence'
import { useCall } from '../features/calls/use-call'
import type { CallType } from '../features/calls/types'
import { isLiveCallState } from '../features/calls/types'

type PresenceToast = { copy: string; join: boolean }

function prefetchCallRooms() {
  // Keep WebRTC out of the initial app bundle, but start downloading it as soon
  // as a person shows intent to call so the room opens without a second wait.
  void import('../features/calls/LiveAudioCallRoom')
  void import('../features/calls/LiveVideoCallRoom')
}

export function HomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startCall, state: callState } = useCall()
  const { couple, partner, setRelationshipDate } = useCouple()
  const { partnerStatus, hydrated } = useCouplePresence()
  const [showArrival, setShowArrival] = useState(Boolean((location.state as { fromLanding?: boolean } | null)?.fromLanding))
  const [shaking, setShaking] = useState(false)
  const [presenceToast, setPresenceToast] = useState<PresenceToast | null>(null)
  const [callChoiceOpen, setCallChoiceOpen] = useState(false)
  const shakeTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)
  const previousStatus = useRef<string | null>(null)
  const partnerName = partner?.display_name ?? 'your person'
  const triggerShake = () => { window.clearTimeout(shakeTimer.current); setShaking(true); shakeTimer.current = window.setTimeout(() => setShaking(false), 330) }
  const beginCall = (callType: CallType) => { prefetchCallRooms(); setCallChoiceOpen(false); void startCall(callType) }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => {
    if (!hydrated || !partner) return
    const previous = previousStatus.current
    previousStatus.current = partnerStatus
    if (!previous) return
    let toast: PresenceToast | null = null
    if (previous === 'offline' && (partnerStatus === 'online' || partnerStatus === 'in_room')) toast = { copy: `${partnerName} showed up.`, join: partnerStatus === 'in_room' }
    if (previous === 'online' && partnerStatus === 'in_room') toast = { copy: `${partnerName} went to the room.`, join: true }
    if (!toast) return
    window.clearTimeout(toastTimer.current)
    setPresenceToast(toast)
    toastTimer.current = window.setTimeout(() => setPresenceToast(null), 2800)
  }, [hydrated, partner, partnerName, partnerStatus])
  return <main className={`home page-shell ${shaking ? 'screen-shake' : ''}`}>
    <header className="space-home-header"><button className="wordmark" onClick={() => navigate('/')} aria-label="Return to landing page">our space<span>TM</span></button><div className="space-home-actions"><span>just you two.</span><UserMenu /></div></header>
    <motion.div className="space-scene-wrap" initial={{ opacity: 0, y: 12, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 190, damping: 21 }}>
      <SharedSpaceScene partnerName={partnerName} partnerStatus={partnerStatus} callIsActive={isLiveCallState(callState)} onCall={() => { prefetchCallRooms(); setCallChoiceOpen(true) }} onWatch={() => navigate('/watch')} onMusic={() => navigate('/room')} onJoinRoom={() => navigate('/room')} relationship={<TogetherCounter startDate={couple?.relationship_started_on ?? null} onSaveDate={setRelationshipDate} />} annoy={<AnnoyButton onShake={triggerShake} />} />
    </motion.div>
    <AnimatePresence>{presenceToast && <motion.aside className="presence-toast" role="status" initial={{ opacity: 0, y: 16, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 1 }} exit={{ opacity: 0, y: 10 }}><span>{presenceToast.copy}</span>{presenceToast.join && <button onClick={() => navigate('/room')}>Join</button>}</motion.aside>}</AnimatePresence>
    <AnimatePresence>{callChoiceOpen && <motion.div className="date-modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose call type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="call-choice-modal call-choice-object" initial={{ scale: .85, y: 24, rotate: -3 }} animate={{ scale: 1, y: 0, rotate: -.6 }} exit={{ scale: .9, y: 12 }}><span className="call-choice-receiver" aria-hidden="true" /><p className="eyebrow">calling {partnerName}</p><h2>How should the phone behave?</h2><div className="call-choice-actions"><button className="call-choice-voice" onClick={() => beginCall('audio')}><Phone size={19} />JUST VOICE <small>this could be a text.</small></button><button className="call-choice-video" onClick={() => beginCall('video')}><Camera size={19} />WITH FACES <small>unfortunately, camera time.</small></button></div><button className="call-choice-cancel" onClick={() => setCallChoiceOpen(false)}>put the receiver back</button></motion.section></motion.div>}</AnimatePresence>
    {showArrival && <PageTransition direction="in" onComplete={() => setShowArrival(false)} />}
  </main>
}
