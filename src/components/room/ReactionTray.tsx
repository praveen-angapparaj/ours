import { Bomb, Heart, Laugh, SendHorizontal, Skull } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { springGentle } from '../../lib/motion'

const reactions = [
  { type: 'heart', symbol: '❤️', label: 'Send a heart', icon: Heart },
  { type: 'laugh', symbol: '😂', label: 'Send a laugh', icon: Laugh },
  { type: 'kiss', symbol: '😘', label: 'Send a kiss', icon: SendHorizontal },
  { type: 'tomato', symbol: '🍅', label: 'Send a playful protest', icon: Bomb },
  { type: 'skull', symbol: '💀', label: 'Send a dramatic reaction', icon: Skull },
] as const

export type ReactionKind = typeof reactions[number]['type']

export function ReactionTray({ open, onReaction }: { open: boolean; onReaction: (type: ReactionKind, symbol: string) => void }) {
  return <AnimatePresence initial={false}>{open && <motion.section className="reaction-tray observatory-reaction-tray" aria-label="Send a signal" initial={{ opacity: 0, y: 16, scale: .82 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 13, scale: .82 }} transition={springGentle}>
    {reactions.map(({ icon: Icon, ...reaction }) => <motion.button key={reaction.type} className={`reaction-tray-button reaction-tray-button-${reaction.type}`} onClick={() => onReaction(reaction.type, reaction.symbol)} aria-label={reaction.label} title={reaction.label} whileHover={{ y: -5, rotate: -7, scale: 1.15 }} whileTap={{ scale: .8 }}><Icon size={18} aria-hidden="true" /></motion.button>)}
  </motion.section>}</AnimatePresence>
}
