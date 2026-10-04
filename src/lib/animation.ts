import { springButton } from './motion'

export const spring = springButton

export const squishTap = { scale: 0.97 } as const

export const popIn = {
  initial: { opacity: 0, scale: 0.94, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: spring,
} as const
