import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

type OrbitFocus = 'you' | 'together' | 'partner'
type PointerTilt = { x: number; y: number }

const stardust = [
  [7, 44, 1], [15, 72, .7], [22, 22, 1.2], [31, 89, .8], [39, 11, .6], [44, 58, .8], [57, 19, 1.3], [65, 74, .7], [73, 9, .8], [85, 38, 1], [92, 68, .65], [78, 91, .9],
] as const

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'your person'
}

function useFinePointer() {
  const [hasFinePointer, setHasFinePointer] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(pointer: fine)')
    const sync = () => setHasFinePointer(query.matches)
    sync()
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync)
      return () => query.removeEventListener('change', sync)
    }
    query.addListener(sync)
    return () => query.removeListener(sync)
  }, [])

  return hasFinePointer
}

export function SharedOrbitUniverse({ partnerInitials, partnerName }: { partnerInitials: string; partnerName: string }) {
  const [focus, setFocus] = useState<OrbitFocus>('together')
  const universeRef = useRef<HTMLDivElement | null>(null)
  const pointerFrameRef = useRef<number | null>(null)
  const pointerTargetRef = useRef<PointerTilt | null>(null)
  const reducedMotion = useReducedMotion()
  const hasFinePointer = useFinePointer()
  const partner = firstName(partnerName)
  const copy = focus === 'you'
    ? 'Your little light keeps this whole orbit warm.'
    : focus === 'partner'
      ? `${partner}'s planet is never far from yours.`
      : 'The shared star is where both your paths keep meeting.'

  const applyPointerTilt = useCallback(() => {
    pointerFrameRef.current = null
    const target = pointerTargetRef.current
    if (!target) return
    universeRef.current?.style.setProperty('--orbit-tilt-x', `${target.x * 10}px`)
    universeRef.current?.style.setProperty('--orbit-tilt-y', `${target.y * 8}px`)
  }, [])

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !hasFinePointer || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const x = (event.clientX - bounds.left) / bounds.width - .5
    const y = (event.clientY - bounds.top) / bounds.height - .5
    pointerTargetRef.current = { x, y }
    if (pointerFrameRef.current === null) pointerFrameRef.current = window.requestAnimationFrame(applyPointerTilt)
  }

  const settle = useCallback(() => {
    pointerTargetRef.current = null
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current)
      pointerFrameRef.current = null
    }
    universeRef.current?.style.setProperty('--orbit-tilt-x', '0px')
    universeRef.current?.style.setProperty('--orbit-tilt-y', '0px')
  }, [])

  useEffect(() => {
    if (reducedMotion || !hasFinePointer) settle()
    return () => settle()
  }, [hasFinePointer, reducedMotion, settle])

  const interactivePointer = hasFinePointer && !reducedMotion
  const cometAnimation = reducedMotion
    ? { opacity: .44 }
    : { x: [0, 82, 0], y: [0, -24, 0], opacity: [0, 1, 0] }

  return <div ref={universeRef} className={`shared-orbit-universe is-focused-${focus}`} onPointerMove={interactivePointer ? move : undefined} onPointerLeave={interactivePointer ? settle : undefined}>
    <div className="shared-orbit-cosmos" aria-hidden="true">
      <i className="orbit-galaxy orbit-galaxy-one" /><i className="orbit-galaxy orbit-galaxy-two" />
      {stardust.map(([left, top, size], index) => <i className="orbit-dust" key={index} style={{ left: `${left}%`, top: `${top}%`, width: `${size * 3}px`, height: `${size * 3}px`, '--dust-delay': `${index * .33}s` } as CSSProperties} />)}
      <svg className="shared-orbit-rings" viewBox="0 0 520 430" preserveAspectRatio="none"><motion.ellipse cx="262" cy="221" rx="231" ry="109" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .68 }} transition={{ duration: 1.2, ease: [0.22, .84, .28, 1] }} /><motion.ellipse cx="262" cy="221" rx="150" ry="182" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .4 }} transition={{ duration: 1.35, delay: .12, ease: [0.22, .84, .28, 1] }} /><path className="shared-orbit-thread" d="M100 306 C176 222 261 158 404 109" /></svg>
      <motion.i className="orbit-comet" animate={cometAnimation} transition={reducedMotion ? { duration: .01 } : { duration: 6.8, repeat: Infinity, ease: 'easeInOut', times: [0, .43, 1] }} />
    </div>
    <div className="shared-orbit-bodies">
      <button type="button" className="orbit-body orbit-body-you" aria-pressed={focus === 'you'} onClick={() => setFocus('you')}><span>Y</span><small>your light</small></button>
      <button type="button" className="orbit-body orbit-body-together" aria-pressed={focus === 'together'} onClick={() => setFocus('together')}><span aria-hidden="true" /><small>your shared star</small><AnimatePresence>{focus === 'together' && <motion.i className="orbit-heart-signal" initial={{ opacity: 0, scale: .45 }} animate={{ opacity: [.9, 0], scale: [.45, 2.3] }} exit={{ opacity: 0 }} transition={{ duration: .92, ease: 'easeOut' }} />}</AnimatePresence></button>
      <button type="button" className="orbit-body orbit-body-partner" aria-pressed={focus === 'partner'} onClick={() => setFocus('partner')}><span>{partnerInitials}</span><small>{partner}'s planet</small></button>
    </div>
    <p className="shared-orbit-whisper" role="status"><i aria-hidden="true" />{copy}</p>
  </div>
}
