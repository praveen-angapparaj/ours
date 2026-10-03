import { AnimatePresence, motion } from 'motion/react'
import { springGentle } from '../../lib/motion'

const reactions = [
  { type: 'heart', symbol: '❤️', label: 'Send heart reaction' },
  { type: 'laugh', symbol: '😂', label: 'Send laughing reaction' },
  { type: 'kiss', symbol: '😘', label: 'Send kiss reaction' },
  { type: 'tomato', symbol: '🍅', label: 'Throw tomato reaction' },
  { type: 'skull', symbol: '💀', label: 'Send skull reaction' },
] as const
export type ReactionKind = typeof reactions[number]['type']

export function ReactionTray({ open, onReaction }: { open: boolean; onReaction: (type: ReactionKind, symbol: string) => void }) {
  return <AnimatePresence initial={false}>{open && <motion.section className="reaction-tray" aria-label="Quick reactions" initial={{ opacity: 0, y: 16, scale: .82 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 13, scale: .82 }} transition={springGentle}>{reactions.map((reaction) => <motion.button key={reaction.type} onClick={() => onReaction(reaction.type, reaction.symbol)} aria-label={reaction.label} whileHover={{ y: -5, rotate: -7, scale: 1.15 }} whileTap={{ scale: .8 }}>{reaction.symbol}</motion.button>)}</motion.section>}</AnimatePresence>
}
