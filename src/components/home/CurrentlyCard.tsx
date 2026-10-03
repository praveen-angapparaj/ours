import { DoorOpen } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { PartnerPresenceStatus } from '../../features/presence/presence-types'
import { ComicCard } from '../ComicCard'

type ActivityCopy = { label: string; title: string; subcopy: string; joinable?: boolean }

function activityFor(status: PartnerPresenceStatus, partnerName: string): ActivityCopy {
  const firstName = partnerName.trim().split(/\s+/)[0] || 'your person'
  if (status === 'in_room') return { label: 'IN THE ROOM', title: `${firstName} saved you a spot.`, subcopy: 'go be a little silly together.', joinable: true }
  if (status === 'online') return { label: 'CURRENTLY', title: 'Two people online.', subcopy: 'suspiciously convenient.' }
  if (status === 'away') return { label: 'CURRENTLY', title: `${firstName} temporarily vanished.`, subcopy: 'probably doing something suspicious.' }
  if (status === 'unknown') return { label: 'CURRENTLY', title: 'Status temporarily unknown.', subcopy: 'reconnecting to the tiny internet universe.' }
  return { label: 'CURRENTLY', title: 'Nothing happening.', subcopy: 'suspiciously peaceful.' }
}

export function CurrentlyCard({ partnerStatus, partnerName, onJoin }: { partnerStatus: PartnerPresenceStatus; partnerName: string; onJoin: () => void }) {
  const reducedMotion = useReducedMotion()
  const state = activityFor(partnerStatus, partnerName)
  return <ComicCard accent="blue" className="currently-card"><div className="card-kicker"><span className="live-squiggle" />{state.label}</div><h2>{state.title}</h2><p>{state.subcopy}</p>{state.joinable ? <button className="currently-join" onClick={onJoin}><DoorOpen size={14} /> Join room</button> : <motion.div className="sleepy-sticker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: .15 } : { type: 'spring', stiffness: 180, damping: 13, delay: .35 }}>zzz</motion.div>}</ComicCard>
}
