import { AnimatePresence, motion } from 'motion/react'
import { Heart, MessageCircle, Music2, Sparkles, Ticket, type LucideIcon } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedButton } from '../components/AnimatedButton'
import { PageTransition } from '../components/PageTransition'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { springGentle, stickerDrop } from '../lib/motion'

type FloatingIcon = { className: string; icon: LucideIcon; delay: number; duration: number; rotate: number; hover: Record<string, number | number[]> }
const floatingIcons: FloatingIcon[] = [
  { className: 'float-heart', icon: Heart, delay: .1, duration: 5.2, rotate: -12, hover: { scale: [1, 1.12, 1], y: [0, -2, 0] } },
  { className: 'float-star', icon: Sparkles, delay: .7, duration: 4.7, rotate: 14, hover: { rotate: [0, 22, 0], scale: [1, 1.08, 1] } },
  { className: 'float-music', icon: Music2, delay: 1.4, duration: 5.8, rotate: -10, hover: { rotate: [0, -10, 8, 0], x: [0, 2, -2, 0] } },
  { className: 'float-ticket', icon: Ticket, delay: .35, duration: 5.45, rotate: -18, hover: { x: [0, -3, 3, 0] } },
  { className: 'float-chat', icon: MessageCircle, delay: 1.1, duration: 4.9, rotate: 10, hover: { y: [0, -4, 0], scale: [1, 1.06, 1] } },
]

export function LandingScreen() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const [origin, setOrigin] = useState<{ x: number; y: number }>()
  const enter = (event: MouseEvent<HTMLButtonElement>) => { const rect = event.currentTarget.getBoundingClientRect(); setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); setLeaving(true) }
  return <main className="landing page-shell">
    {floatingIcons.map(({ className, icon: Icon, delay, duration, rotate, hover }) => <motion.div key={className} className={`landing-float ${className}`} animate={reducedMotion ? undefined : { y: [0, -7, 0], rotate: [rotate, rotate + 3, rotate] }} transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }} whileHover={reducedMotion ? undefined : hover} aria-hidden="true"><Icon fill={className === 'float-heart' ? 'currentColor' : 'none'} /></motion.div>)}
    <motion.div className="landing-dots" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}>· · ·</motion.div>
    <section className="landing-content">
      <motion.p className="eyebrow" initial={{ opacity: 0, y: -7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .17 }}>a really exclusive club</motion.p>
      <h1><motion.span className="landing-word word-our" initial={{ opacity: 0, y: -20, rotate: -7 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ ...springGentle, delay: .07 }}>Our</motion.span><motion.em className="landing-word word-space" initial={{ opacity: 0, y: 18, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ ...springGentle, delay: .14 }}>Space</motion.em></h1>
      <motion.div className="population-sticker" {...stickerDrop}>Population: 2</motion.div>
      <motion.p className="landing-subtitle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .22 }}>a tiny internet corner<br />that's just ours.</motion.p>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4, duration: .2 }}><AnimatedButton tone="coral" className="enter-button" onClick={enter}>Enter our chaos <span>→</span></AnimatedButton></motion.div>
      <motion.p className="tiny-rule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .48 }}>no adults allowed*<br /><i>*we are technically adults</i></motion.p>
    </section>
    <AnimatePresence>{leaving && <PageTransition direction="out" origin={origin} onComplete={() => navigate('/home', { state: { fromLanding: true } })} />}</AnimatePresence>
  </main>
}
