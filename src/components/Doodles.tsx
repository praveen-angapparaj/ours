import { motion, useMotionValue, useSpring } from 'motion/react'
import { useEffect } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'

export function CursorDoodle() {
  const reduceMotion = useReducedMotion()
  const x = useSpring(useMotionValue(-100), { stiffness: 80, damping: 15 })
  const y = useSpring(useMotionValue(-100), { stiffness: 80, damping: 15 })
  useEffect(() => { if (reduceMotion || !window.matchMedia('(pointer: fine)').matches) return; const move = (event: PointerEvent) => { x.set(event.clientX + 18); y.set(event.clientY + 18) }; window.addEventListener('pointermove', move); return () => window.removeEventListener('pointermove', move) }, [reduceMotion, x, y])
  if (reduceMotion) return null
  return <motion.div className="cursor-doodle" style={{ x, y }} aria-hidden="true">✦</motion.div>
}
