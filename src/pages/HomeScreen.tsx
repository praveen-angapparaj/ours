import { AnimatePresence, motion } from 'motion/react'
import { Camera, Film, Headphones, Phone, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActionCard, type ActionKind } from '../components/home/ActionCard'
import { AnnoyButton } from '../components/home/AnnoyButton'
import { CurrentlyCard } from '../components/home/CurrentlyCard'
import { PartnerPresence } from '../components/home/PartnerPresence'
import { TogetherCounter } from '../components/home/TogetherCounter'
import { UserMenu } from '../components/home/UserMenu'
import { PageTransition } from '../components/PageTransition'
import { useCouple } from '../features/couple/use-couple'
import { useCouplePresence } from '../features/presence/use-couple-presence'
import { useCall } from '../features/calls/use-call'
import type { CallType } from '../features/calls/types'
import type { PartnerPresenceStatus } from '../features/presence/presence-types'
import { pronounsFor } from '../features/auth/pronouns'

type HangoutAction = { title: string; caption: string; icon: typeof Phone; tone: 'coral' | 'yellow' | 'lavender'; kind: ActionKind }
type PresenceToast = { copy: string; join: boolean }

const actions: HangoutAction[] = [
  { title: 'CALL THEM', caption: 'say hi, be weird', icon: Phone, tone: 'coral', kind: 'call' },
  { title: 'WATCH SOMETHING', caption: 'argue about the plot', icon: Film, tone: 'yellow', kind: 'watch' },
  { title: 'PLAY MUSIC', caption: 'DJ privileges pending', icon: Headphones, tone: 'lavender', kind: 'music' },
]
export function HomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startCall } = useCall()
  const { couple, partner, setRelationshipDate } = useCouple()
  const { partnerStatus, hydrated } = useCouplePresence()
  const [showArrival, setShowArrival] = useState(Boolean((location.state as { fromLanding?: boolean } | null)?.fromLanding))
  const [shaking, setShaking] = useState(false)
  const [presenceToast, setPresenceToast] = useState<PresenceToast | null>(null)
  const [callChoiceOpen, setCallChoiceOpen] = useState(false)
  const noteIndex = useState(() => Math.floor(Math.random() * 3))[0]
  const shakeTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)
  const previousStatus = useRef<PartnerPresenceStatus | null>(null)
  const partnerName = partner?.display_name ?? 'your person'
  const partnerPronouns = pronounsFor(partner?.pronoun_set)
  const notes = [
    <>today's important agenda:<br /><b>absolutely nothing</b></>,
    <>{partnerPronouns.subject} owes you one movie btw <b>-&gt;</b></>,
    <>important reminder:<br /><b>be a little silly</b></>,
  ]
  const note = notes[noteIndex]
  const triggerShake = () => { window.clearTimeout(shakeTimer.current); setShaking(true); shakeTimer.current = window.setTimeout(() => setShaking(false), 330) }
  const beginCall = (callType: CallType) => { setCallChoiceOpen(false); void startCall(callType) }
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
    <header className="app-header"><button className="wordmark" onClick={() => navigate('/')} aria-label="Return to landing page">our space<span>TM</span></button><div className="header-people"><UserMenu /><PartnerPresence status={partnerStatus} name={partnerName} onJoin={() => navigate('/room')} onCall={() => void startCall()} /></div></header>
    <div className="home-layout">
      <motion.section className="home-intro" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .26 }}>
        <div className="paper-note">{note}</div>
        <p className="eyebrow">your very private corner of the web</p>
        <h1>Wanna<br /><em>hang out?</em></h1>
        <p className="home-copy">Your favourite tiny person is one button away. That seems suspiciously convenient.</p>
        <div className="hangout-actions">{actions.map((action) => <ActionCard key={action.title} {...action} title={action.kind === 'call' ? `CALL ${partnerPronouns.object.toUpperCase()}` : action.title} onClick={action.kind === 'call' ? () => setCallChoiceOpen(true) : () => navigate('/room')} />)}</div>
      </motion.section>
      <aside className="home-widgets"><CurrentlyCard partnerStatus={partnerStatus} partnerName={partnerName} onJoin={() => navigate('/room')} /><TogetherCounter startDate={couple?.relationship_started_on ?? null} onSaveDate={setRelationshipDate} /><AnnoyButton onShake={triggerShake} partnerPronouns={partnerPronouns} /><div className="micro-doodle"><Sparkles /><span>very serious<br />business</span></div></aside>
    </div>
    <AnimatePresence>{presenceToast && <motion.aside className="presence-toast" role="status" initial={{ opacity: 0, y: 16, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 1 }} exit={{ opacity: 0, y: 10 }}><span>{presenceToast.copy}</span>{presenceToast.join && <button onClick={() => navigate('/room')}>Join</button>}</motion.aside>}</AnimatePresence>
    <AnimatePresence>{callChoiceOpen && <motion.div className="date-modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose call type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="date-modal call-choice-modal" initial={{ scale: .94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .94, y: 14 }}><p className="eyebrow">how annoying are we being?</p><h2>pick a tiny kind of chaos.</h2><div className="call-choice-actions"><button className="animated-button tone-yellow" onClick={() => beginCall('audio')}><Phone size={18} />VOICE CALL</button><button className="animated-button tone-coral" onClick={() => beginCall('video')}><Camera size={18} />VIDEO CALL</button></div><button className="call-choice-cancel" onClick={() => setCallChoiceOpen(false)}>not right now</button></motion.section></motion.div>}</AnimatePresence>
    {showArrival && <PageTransition direction="in" onComplete={() => setShowArrival(false)} />}
  </main>
}
