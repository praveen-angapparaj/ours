import { motion } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'

type PageTransitionProps = { direction: 'in' | 'out'; origin?: { x: number; y: number }; onComplete?: () => void }

export function PageTransition({ direction, origin, onComplete }: PageTransitionProps) {
  const reducedMotion = useReducedMotion()
  const isEntering = direction === 'in'
  const position = origin ? { left: origin.x - 45, top: origin.y - 45 } : undefined
  return <motion.div aria-hidden="true" className="heart-transition" style={position} initial={{ scale: isEntering ? 28 : 0, rotate: -14, opacity: 1 }} animate={{ scale: isEntering ? 0 : reducedMotion ? 18 : 28, rotate: isEntering ? 6 : 14, opacity: isEntering && reducedMotion ? 0 : 1 }} transition={reducedMotion ? { duration: .2 } : { duration: .76, ease: [0.22, .85, .28, 1] }} onAnimationComplete={onComplete}><span>♥</span></motion.div>
}
