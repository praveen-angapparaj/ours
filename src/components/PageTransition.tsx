import { motion } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'

type PageTransitionProps = { direction: 'in' | 'out'; origin?: { x: number; y: number }; onComplete?: () => void }

export function PageTransition({ direction, origin, onComplete }: PageTransitionProps) {
  const reducedMotion = useReducedMotion()
  const isEntering = direction === 'in'
  const position = origin ? { left: origin.x, top: origin.y } : undefined
  return <motion.div aria-hidden="true" className="orbit-transition" style={position} initial={{ scale: isEntering ? 26 : 0, opacity: 1 }} animate={{ scale: isEntering ? 0 : reducedMotion ? 18 : 26, opacity: isEntering && reducedMotion ? 0 : 1 }} transition={reducedMotion ? { duration: .2 } : { duration: .7, ease: [0.22, .85, .28, 1] }} onAnimationComplete={onComplete}><span /><i /></motion.div>
}
