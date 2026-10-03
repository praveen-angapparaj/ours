import { motion } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { reactionFloat, reactionThrow } from '../lib/motion'

export type Reaction = { id: number; symbol: string; kind: 'heart' | 'laugh' | 'kiss' | 'tomato' | 'skull'; x: number; rotation: number }

export function FloatingReaction({ reaction, onDone }: { reaction: Reaction; onDone: (id: number) => void }) {
  const reducedMotion = useReducedMotion()
  const target = reducedMotion ? { y: -28, x: 0 } : reaction.kind === 'tomato' ? { y: [0, -180, -430], x: [0, 125, 340] } : reaction.kind === 'skull' ? { y: [0, 44, 86], x: [0, 4, -4] } : reaction.kind === 'kiss' ? { y: -330, x: 145 } : reaction.kind === 'laugh' ? { y: [0, -110, -205, -330], x: [0, -18, 13, -8] } : { y: -370, x: 0 }
  const transition = reaction.kind === 'tomato' ? reactionThrow : reactionFloat
  return <motion.div className={`floating-reaction reaction-${reaction.kind}`} style={{ left: `calc(50% + ${reaction.x}px)` }} initial={{ y: 0, x: 0, opacity: 0, scale: .55, rotate: 0 }} animate={{ ...target, opacity: [0, 1, 1, 0], scale: reaction.kind === 'tomato' ? [.65, 1.35, 1.08, .82] : [.6, 1.25, 1.06], rotate: reaction.rotation }} transition={reducedMotion ? { duration: .25 } : transition} onAnimationComplete={() => onDone(reaction.id)}>
    <span>{reaction.symbol}</span>{reaction.kind === 'tomato' && <motion.b className="tomato-splat" initial={{ opacity: 0, scale: .4 }} animate={{ opacity: [0, 0, 1, 0], scale: [0, 0, 1.15, .9] }} transition={{ duration: .8, delay: .3 }}>SPLAT!</motion.b>}{reaction.kind === 'skull' && <b>I have died.</b>}
  </motion.div>
}
