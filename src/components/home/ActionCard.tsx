import { motion } from 'motion/react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { cardHover, cardPress, springButton } from '../../lib/motion'

export type ActionKind = 'call' | 'watch' | 'music'
type ActionCardProps = { title: string; caption: string; icon: LucideIcon; tone: 'coral' | 'yellow' | 'lavender'; kind: ActionKind; onClick: () => void }

export function ActionCard({ title, caption, icon: Icon, tone, kind, onClick }: ActionCardProps) {
  const [hovered, setHovered] = useState(false)
  const iconAnimation = kind === 'call' ? { rotate: [0, -13, 12, 0] } : kind === 'watch' ? { rotate: [0, -8, 6, 0], scale: [1, 1.08, 1] } : { y: [0, -4, 0] }
  return <motion.button className={`hangout-action action-${tone} action-${kind}`} onClick={onClick} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} whileHover={cardHover} whileTap={cardPress} transition={springButton}>
    <motion.span className="action-icon" animate={hovered ? iconAnimation : { rotate: 0, scale: 1, y: 0 }} transition={{ duration: .36 }}><Icon /></motion.span>
    <span><b>{title}</b><small>{caption}</small></span><motion.span className="action-arrow" animate={hovered ? { x: 3, y: -3 } : { x: 0, y: 0 }}><ArrowUpRight /></motion.span>
  </motion.button>
}
