import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { squishTap, spring } from '../lib/animation'

type AnimatedButtonProps = HTMLMotionProps<'button'> & {
  children: ReactNode
  tone?: 'coral' | 'yellow' | 'lavender' | 'mint' | 'paper' | 'ink'
  className?: string
}

export function AnimatedButton({ children, tone = 'paper', className = '', ...props }: AnimatedButtonProps) {
  return (
    <motion.button {...props} className={`animated-button tone-${tone} ${className}`} whileHover={{ scale: 1.035, rotate: -1.2 }} whileTap={squishTap} transition={spring}>
      {children}
    </motion.button>
  )
}
