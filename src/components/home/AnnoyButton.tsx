import { AnimatePresence, motion } from 'motion/react'
import { BellRing } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AnimatedButton } from '../AnimatedButton'

type Notice = { id: number; text: string }

export function AnnoyButton({ onShake }: { onShake: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [count, setCount] = useState(0)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])
  const annoy = () => {
    const nextCount = count + 1; setCount(nextCount); onShake()
    const messages = ['tiny disturbance noted.', 'the button has spoken.', 'professional nuisance.', 'no one was harmed.', 'worth it.']
    const text = nextCount >= 10 ? 'okay calm down.' : messages[Math.floor(Math.random() * messages.length)]
    const id = Date.now() + Math.random(); setNotices((current) => [...current.slice(-1), { id, text }])
    const timer = window.setTimeout(() => { setNotices((current) => current.filter((notice) => notice.id !== id)); timers.current = timers.current.filter((item) => item !== timer) }, 1750)
    timers.current.push(timer)
  }
  return <div className="annoy-wrap"><AnimatedButton tone="ink" className="annoy-button" onClick={annoy}><BellRing size={18} /> PRESS THE TINY RED BUTTON {count >= 3 && <small>x{count}</small>}</AnimatedButton><AnimatePresence>{notices.map((notice) => <motion.span key={notice.id} className="annoy-result" initial={{ opacity: 0, y: 8, scale: .7 }} animate={{ opacity: 1, y: -14, scale: 1 }} exit={{ opacity: 0, y: -34, scale: .9 }} transition={{ type: 'spring', stiffness: 340, damping: 20 }}>{notice.text}</motion.span>)}</AnimatePresence></div>
}
