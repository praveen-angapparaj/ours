import { AnimatePresence, motion } from 'motion/react'
import { Camera, Film, Headphones, Phone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActionCard, type ActionKind } from '../components/home/ActionCard'
import { CurrentlyCard } from '../components/home/CurrentlyCard'
import { PartnerPresence } from '../components/home/PartnerPresence'
import { TogetherCounter } from '../components/home/TogetherCounter'
import { UserMenu } from '../components/home/UserMenu'
import { PageTransition } from '../components/PageTransition'
import { useCouple } from '../features/couple/use-couple'
import { profileInitials } from '../features/couple/profile-initials'
import { useCouplePresence } from '../features/presence/use-couple-presence'
import { useCall } from '../features/calls/use-call'
import { AffectionDock } from '../features/affection/AffectionDock'
import { SharedOrbitUniverse } from '../features/universe/SharedOrbitUniverse'
import type { CallType } from '../features/calls/types'
import type { PartnerPresenceStatus } from '../features/presence/presence-types'
import { pronounsFor } from '../features/auth/pronouns'

type HangoutAction = { title: string; caption: string; icon: typeof Phone; tone: 'coral' | 'yellow' | 'lavender'; kind: ActionKind }
type PresenceToast = { copy: string; join: boolean }

const actions: HangoutAction[] = [
  { title: 'CALL', caption: 'hear their voice', icon: Phone, tone: 'coral', kind: 'call' },
  { title: 'WATCH TOGETHER', caption: 'find a shared distraction', icon: Film, tone: 'yellow', kind: 'watch' },
  { title: 'LISTEN TOGETHER', caption: 'put something on', icon: Headphones, tone: 'lavender', kind: 'music' },
]

function prefetchCallRooms() {
  void import('../features/calls/LiveAudioCallRoom')
  void import('../features/calls/LiveVideoCallRoom')
}

function presenceLine(status: PartnerPresenceStatus, partnerName: string) {
  if (status === 'in_room') return `${partnerName} is in your space.`
  if (status === 'online') return `${partnerName} is here too.`
  if (status === 'away') return `${partnerName} stepped away for a while.`
  if (status === 'unknown') return 'Reconnecting to your shared space.'
  return 'The other side is quiet for now.'
}

export function HomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startCall } = useCall()
  const { couple, partner, setRelationshipDate } = useCouple()
  const { partnerStatus, hydrated } = useCouplePresence()
  const [showArrival, setShowArrival] = useState(Boolean((location.state as { fromLanding?: boolean } | null)?.fromLanding))
  const [presenceToast, setPresenceToast] = useState<PresenceToast | null>(null)
  const [callChoiceOpen, setCallChoiceOpen] = useState(false)
  const toastTimer = useRef<number | undefined>(undefined)
  const previousStatus = useRef<PartnerPresenceStatus | null>(null)
  const partnerName = partner?.display_name ?? 'your person'
  const partnerFirstName = partnerName.trim().split(/\s+/)[0] || 'your person'
  const partnerPronouns = pronounsFor(partner?.pronoun_set)
  const partnerInitials = profileInitials(partnerName, 'O')
  const activePresence = partnerStatus === 'online' || partnerStatus === 'in_room'

  const beginCall = (callType: CallType) => {
    prefetchCallRooms()
    setCallChoiceOpen(false)
    void startCall(callType)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => {
    if (!hydrated || !partner) return
    const previous = previousStatus.current
    previousStatus.current = partnerStatus
    if (!previous) return
    const arrived = previous === 'offline' && (partnerStatus === 'online' || partnerStatus === 'in_room')
    const entered = previous === 'online' && partnerStatus === 'in_room'
    if (!arrived && !entered) return
    window.clearTimeout(toastTimer.current)
    setPresenceToast({ copy: entered ? `${partnerFirstName} entered your space.` : `${partnerFirstName} is here.`, join: partnerStatus === 'in_room' })
    toastTimer.current = window.setTimeout(() => setPresenceToast(null), 2800)
  }, [hydrated, partner, partnerFirstName, partnerStatus])

  return <main className={`home home-signature page-shell presence-${partnerStatus}`}>
    <div className="home-sky" aria-hidden="true"><i className="home-star home-star-one" /><i className="home-star home-star-two" /><i className="home-star home-star-three" /></div>
    <header className="app-header"><button className="wordmark" onClick={() => navigate('/home')} aria-label="Return to home">our space<span>TM</span></button><div className="header-people"><UserMenu /><PartnerPresence status={partnerStatus} name={partnerName} onJoin={() => navigate('/room')} onCall={() => { prefetchCallRooms(); void startCall() }} /></div></header>
    <section className="home-orbit-layout">
      <section className="home-presence-hero" aria-label={`${partnerName}'s presence`}>
        <p className="eyebrow">YOUR SHARED ORBIT</p>
        <motion.div initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .48, ease: 'easeOut' }}><SharedOrbitUniverse partnerInitials={partnerInitials} partnerName={partnerName} /></motion.div>
        <motion.div className="home-hero-copy" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1, duration: .35 }}><span className="home-presence-state"><i />{partnerStatus === 'in_room' ? 'IN YOUR SPACE' : activePresence ? 'ONLINE NOW' : partnerStatus.toUpperCase()}</span><h1>{partnerFirstName}<br /><em>is on the other side.</em></h1><p>{presenceLine(partnerStatus, partnerFirstName)}</p></motion.div>
      </section>
      <section className="home-actions-zone" aria-label="Ways to spend time together">
        <p className="home-actions-label">WHAT DO YOU FEEL LIKE?</p>
        <div className="hangout-actions">{actions.map((action) => <ActionCard key={action.title} {...action} title={action.kind === 'call' ? `CALL ${partnerPronouns.object.toUpperCase()}` : action.title} onClick={action.kind === 'call' ? () => { prefetchCallRooms(); setCallChoiceOpen(true) } : action.kind === 'watch' ? () => navigate('/watch') : () => navigate('/watch?category=music')} />)}</div>
        <AffectionDock partnerName={partnerName} />
        {partnerStatus === 'in_room' && <button className="home-room-link" onClick={() => navigate('/room')}>Join {partnerFirstName} in the room <span>&rarr;</span></button>}
      </section>
      <aside className="home-secondary" aria-label="Your shared details"><CurrentlyCard partnerStatus={partnerStatus} partnerName={partnerName} onJoin={() => navigate('/room')} /><TogetherCounter startDate={couple?.relationship_started_on ?? null} onSaveDate={setRelationshipDate} /></aside>
    </section>
    <AnimatePresence>{presenceToast && <motion.aside className="presence-toast" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}><span>{presenceToast.copy}</span>{presenceToast.join && <button onClick={() => navigate('/room')}>Enter</button>}</motion.aside>}</AnimatePresence>
    <AnimatePresence>{callChoiceOpen && <motion.div className="date-modal-backdrop call-choice-backdrop" role="dialog" aria-modal="true" aria-label="Choose call type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="date-modal call-choice-modal" initial={{ scale: .96, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .96, y: 14 }}><p className="eyebrow">OPEN A LINE</p><h2>How would you like to be together?</h2><p className="call-choice-copy">Choose a voice call for the background of each other&apos;s day, or video when faces are required.</p><div className="call-choice-actions"><button className="animated-button tone-yellow" onClick={() => beginCall('audio')}><Phone size={18} />VOICE CALL</button><button className="animated-button tone-coral" onClick={() => beginCall('video')}><Camera size={18} />VIDEO CALL</button></div><button className="call-choice-cancel" onClick={() => setCallChoiceOpen(false)}>Not right now</button></motion.section></motion.div>}</AnimatePresence>
    {showArrival && <PageTransition direction="in" onComplete={() => setShowArrival(false)} />}
  </main>
}
