import { motion } from 'motion/react'

export function AppLoader({ message = 'assembling the nonsense...' }: { message?: string }) {
  return <main className="app-loader page-shell"><motion.div className="loader-sticker" animate={{ rotate: [-3, 3, -3], y: [0, -4, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}>✦</motion.div><p>{message}</p><span>· · ·</span></main>
}
