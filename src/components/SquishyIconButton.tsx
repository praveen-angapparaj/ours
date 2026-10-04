import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { squishTap, spring } from '../lib/animation'
import { ComicTooltip } from './ComicTooltip'

type SquishyIconButtonProps = HTMLMotionProps<'button'> & { children: ReactNode; label: string; tooltip?: string; active?: boolean; danger?: boolean; className?: string }

export function SquishyIconButton({ children, label, tooltip, active, danger, className = '', ...props }: SquishyIconButtonProps) {
  return <span className="icon-button-wrap"><motion.button {...props} aria-label={label} className={`squishy-icon-button ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''} ${className}`} whileHover={{ y: -1, scale: 1.02 }} whileTap={squishTap} transition={spring}>{children}</motion.button><ComicTooltip>{tooltip ?? label}</ComicTooltip></span>
}
