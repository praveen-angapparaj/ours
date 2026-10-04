export const springButton = { type: 'spring', stiffness: 360, damping: 28, mass: 0.72 } as const
export const springGentle = { type: 'spring', stiffness: 190, damping: 24, mass: 0.9 } as const

export const cardHover = { y: -2, scale: 1.008 } as const
export const cardPress = { y: 1, scale: 0.99 } as const

export const pageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: 'easeOut' },
} as const

export const stickerDrop = {
  initial: { opacity: 0, scale: 0.9, y: -8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { ...springGentle, delay: 0.2 },
} as const

export const popover = {
  initial: { opacity: 0, scale: 0.96, y: -5 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: -3 },
  transition: springGentle,
} as const

export const reactionFloat = { duration: 1.35, ease: 'easeOut' } as const
export const reactionThrow = { duration: 0.82, ease: [0.2, 0.72, 0.3, 1] } as const
export const modalEnter = { type: 'spring', stiffness: 300, damping: 22, mass: 0.75 } as const
