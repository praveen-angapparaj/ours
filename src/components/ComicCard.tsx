import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { spring } from '../lib/animation'

type ComicCardProps = HTMLMotionProps<'div'> & { children: ReactNode; accent?: 'coral' | 'yellow' | 'lavender' | 'blue' | 'mint' | 'paper' | 'ink'; className?: string; interactive?: boolean }

export function ComicCard({ children, accent = 'paper', interactive = false, className = '', ...props }: ComicCardProps) {
  return <motion.div {...props} className={`comic-card card-${accent} ${interactive ? 'is-interactive' : ''} ${className}`} whileHover={interactive ? { y: -2, scale: 1.008 } : undefined} transition={spring}>{children}</motion.div>
}
