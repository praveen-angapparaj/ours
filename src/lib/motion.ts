export const springButton = { type: 'spring', stiffness: 420, damping: 23, mass: 0.65 } as const
export const springGentle = { type: 'spring', stiffness: 230, damping: 20, mass: 0.8 } as const

export const cardHover = { y: -4, rotate: 0.35, scale: 1.008 } as const
export const cardPress = { y: 2, scale: 0.985 } as const

export const pageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: 'easeOut' },
} as const

export const stickerDrop = {
  initial: { opacity: 0, scale: 0.62, rotate: 9, y: -8 },
  animate: { opacity: 1, scale: 1, rotate: 5, y: 0 },
  transition: { ...springGentle, delay: 0.2 },
} as const

export const popover = {
  initial: { opacity: 0, scale: 0.82, y: -7, rotate: -2 },
  animate: { opacity: 1, scale: 1, y: 0, rotate: 0 },
  exit: { opacity: 0, scale: 0.9, y: -5 },
  transition: springGentle,
} as const

export const reactionFloat = { duration: 1.35, ease: 'easeOut' } as const
export const reactionThrow = { duration: 0.82, ease: [0.2, 0.72, 0.3, 1] } as const
export const modalEnter = { type: 'spring', stiffness: 300, damping: 22, mass: 0.75 } as const
