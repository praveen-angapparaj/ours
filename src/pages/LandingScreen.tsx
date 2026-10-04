import { AnimatePresence, motion } from 'motion/react'
import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatedButton } from '../components/AnimatedButton'
import { PageTransition } from '../components/PageTransition'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { springGentle } from '../lib/motion'

export function LandingScreen() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const [origin, setOrigin] = useState<{ x: number; y: number }>()
  const enter = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setLeaving(true)
  }

  return <main className="landing page-shell">
    <div className="landing-orbit-field" aria-hidden="true">
      <span className="landing-orbit landing-orbit-one" />
      <span className="landing-orbit landing-orbit-two" />
      <motion.span className="landing-point landing-point-you" animate={reducedMotion ? undefined : { y: [0, -5, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.span className="landing-point landing-point-them" animate={reducedMotion ? undefined : { y: [0, 5, 0] }} transition={{ duration: 5.3, repeat: Infinity, ease: 'easeInOut' }} />
      <span className="landing-shared-light" />
    </div>
    <section className="landing-content">
      <motion.p className="eyebrow" initial={{ opacity: 0, y: -7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}>A PRIVATE PLACE FOR TWO</motion.p>
      <h1><motion.span className="landing-word word-our" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springGentle, delay: .07 }}>Our</motion.span><motion.em className="landing-word word-space" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springGentle, delay: .14 }}>Space</motion.em></h1>
      <motion.p className="landing-subtitle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .28, duration: .24 }}>One small corner of the internet<br />that knows there are only two of you.</motion.p>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .38, duration: .24 }}><AnimatedButton tone="paper" className="enter-button" onClick={enter}>Enter your space <span>&rarr;</span></AnimatedButton></motion.div>
      <motion.p className="tiny-rule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .48 }}>RESERVED FOR TWO</motion.p>
    </section>
    <AnimatePresence>{leaving && <PageTransition direction="out" origin={origin} onComplete={() => navigate('/home', { state: { fromLanding: true } })} />}</AnimatePresence>
  </main>
}
