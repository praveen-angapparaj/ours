import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
const statuses = ["she's somewhere on the internet", 'causing problems online', 'probably being adorable', 'one meme away from chaos']
export function StatusBubble() {
  const [index, setIndex] = useState(0)
  useEffect(() => { const timer = window.setInterval(() => setIndex((current) => (current + 1) % statuses.length), 3500); return () => window.clearInterval(timer) }, [])
  return <div className="status-bubble" aria-live="polite"><span className="online-dot" /><motion.span key={statuses[index]} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{statuses[index]}</motion.span></div>
}
