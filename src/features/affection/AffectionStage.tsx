import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { affectionMomentCopy, type AffectionMoment } from './affection-types'
import { HeartVessel, StarSigil } from './AffectionIllustrations'

type Point = { x: number; y: number }
type Viewport = { width: number; height: number }
type ExclusionRect = { x: number; y: number; width: number; height: number }

function cubicPoint(t: number, start: Point, controlOne: Point, controlTwo: Point, end: Point): Point {
  const inverse = 1 - t
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlOne.x + 3 * inverse * t ** 2 * controlTwo.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlOne.y + 3 * inverse * t ** 2 * controlTwo.y + t ** 3 * end.y,
  }
}

function useViewport() {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => { window.removeEventListener('resize', sync); window.removeEventListener('orientationchange', sync) }
  }, [])
  return viewport
}

function visibleSharedStar(viewport: Viewport) {
  const star = document.querySelector<HTMLElement>('.orbit-body-together')
  const bounds = star?.getBoundingClientRect()
  if (!bounds || bounds.width <= 0 || bounds.height <= 0 || bounds.right < 0 || bounds.left > viewport.width || bounds.bottom < 64 || bounds.top > viewport.height - 64) return null
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
}

function visibleHomeControlRects(viewport: Viewport): ExclusionRect[] {
  const padding = 9
  return ['.home-actions-zone', '.home-secondary'].flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
    const bounds = element.getBoundingClientRect()
    const left = Math.max(0, bounds.left - padding)
    const top = Math.max(0, bounds.top - padding)
    const right = Math.min(viewport.width, bounds.right + padding)
    const bottom = Math.min(viewport.height, bounds.bottom + padding)
    return right > left && bottom > top ? [{ x: left, y: top, width: right - left, height: bottom - top }] : []
  }))
}

function useHomeControlMasks(viewport: Viewport) {
  const [scrollTick, setScrollTick] = useState(0)
  useEffect(() => {
    const sync = () => setScrollTick((current) => current + 1)
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [])
  return useMemo(() => visibleHomeControlRects(viewport), [scrollTick, viewport.height, viewport.width])
}

function InteractionExclusionMask({ id, viewport, rects }: { id: string; viewport: Viewport; rects: ExclusionRect[] }) {
  return <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width={viewport.width} height={viewport.height}>
    <rect width={viewport.width} height={viewport.height} fill="#fff" />
    {rects.map((rect, index) => <rect key={index} {...rect} fill="#000" />)}
  </mask>
}

function ThoughtArrival({ moment, reducedMotion }: { moment: AffectionMoment; reducedMotion: boolean }) {
  const viewport = useViewport()
  const controlMasks = useHomeControlMasks(viewport)
  const maskId = `thought-controls-${moment.id}`
  const path = useMemo(() => {
    const compact = viewport.width <= 760
    const sharedStar = visibleSharedStar(viewport)
    const start = { x: viewport.width + 28, y: Math.max(90, viewport.height * .22) }
    const end = sharedStar ?? (compact
      ? { x: viewport.width * .5, y: Math.max(126, viewport.height * .17) }
      : { x: Math.min(viewport.width * .32, viewport.width - 118), y: Math.max(182, viewport.height * .42) })
    const c1 = compact ? { x: viewport.width * .82, y: Math.max(46, viewport.height * .09) } : { x: viewport.width * .8, y: Math.max(30, viewport.height * .05) }
    const c2 = compact ? { x: viewport.width * .63, y: Math.max(108, viewport.height * .26) } : { x: viewport.width * .52, y: Math.max(122, viewport.height * .56) }
    const points = Array.from({ length: 8 }, (_, index) => cubicPoint(index / 7, start, c1, c2, end))
    return { start, end, c1, c2, points, d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}` }
  }, [viewport.height, viewport.width])

  if (moment.deferred) return <QuietArrival moment={moment} kind="thought" />
  return <motion.div className="affection-stage-event affection-stage-thought" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <svg className="affection-stage-canvas" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" aria-hidden="true">
      {controlMasks.length > 0 && <defs><InteractionExclusionMask id={maskId} viewport={viewport} rects={controlMasks} /></defs>}
      <g mask={controlMasks.length ? `url(#${maskId})` : undefined}>
        <motion.path d={path.d} className="thought-flight-path" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: .92, opacity: [0, .82, .45, 0] }} transition={{ duration: reducedMotion ? .01 : 2.6, times: [0, .15, .74, 1], ease: [0.22, .78, .28, 1] }} />
        <motion.g initial={{ x: path.start.x, y: path.start.y, scale: .34, opacity: 0 }} animate={{ x: path.points.map((point) => point.x), y: path.points.map((point) => point.y), scale: [.34, 1, .84, .46], opacity: [0, 1, 1, 0] }} transition={{ duration: reducedMotion ? .01 : 2.28, times: [0, .14, .72, 1], ease: [0.22, .78, .28, 1] }}><circle r="17" className="thought-star-halo" /><path d="M0 -10C1.2 -2.8 2.8 -1.2 10 0 2.8 1.2 1.2 2.8 0 10-1.2 2.8-2.8 1.2-10 0-2.8-1.2-1.2-2.8 0-10Z" className="thought-star-core" /></motion.g>
        <motion.g initial={{ opacity: 0, scale: .45 }} animate={{ opacity: [0, 0, 1, 1, .46], scale: [.45, .45, 1, 1.1, 1.06] }} transition={{ duration: reducedMotion ? .01 : 3.52, times: [0, .44, .55, .79, 1], ease: 'easeOut' }} style={{ transformOrigin: `${path.end.x}px ${path.end.y}px` }}><path d={`M ${path.end.x} ${path.end.y - 18} L ${path.end.x - 16} ${path.end.y - 4} L ${path.end.x - 11} ${path.end.y + 16} L ${path.end.x} ${path.end.y + 5} L ${path.end.x + 11} ${path.end.y + 16} L ${path.end.x + 16} ${path.end.y - 4} Z`} className="thought-constellation-line" /><circle cx={path.end.x} cy={path.end.y - 18} r="2.5" className="thought-constellation-dot" /><circle cx={path.end.x - 16} cy={path.end.y - 4} r="2.5" className="thought-constellation-dot" /><circle cx={path.end.x + 16} cy={path.end.y - 4} r="2.5" className="thought-constellation-dot" /><circle cx={path.end.x - 11} cy={path.end.y + 16} r="2.5" className="thought-constellation-dot" /><circle cx={path.end.x + 11} cy={path.end.y + 16} r="2.5" className="thought-constellation-dot" /></motion.g>
        <motion.text x={path.end.x + 27} y={path.end.y + 8} className="thought-arrival-note" initial={{ opacity: 0, y: 4 }} animate={{ opacity: [0, 0, 1, 1, .52], y: [4, 4, 0, 0, -1] }} transition={{ duration: reducedMotion ? .01 : 3.52, times: [0, .47, .59, .79, 1], ease: 'easeOut' }}>for you</motion.text>
      </g>
    </svg>
    <span className="visually-hidden">A little thought from your person.</span>
  </motion.div>
}

function EmbraceArrival({ moment, reducedMotion }: { moment: AffectionMoment; reducedMotion: boolean }) {
  const viewport = useViewport()
  const controlMasks = useHomeControlMasks(viewport)
  const maskId = `embrace-controls-${moment.id}`
  const geometry = useMemo(() => {
    const compact = viewport.width <= 760
    const center = visibleSharedStar(viewport) ?? { x: viewport.width * .5, y: compact ? Math.max(166, viewport.height * .24) : Math.max(176, viewport.height * .42) }
    const left = `M -42 ${center.y + 22} C ${viewport.width * .2} ${center.y - 74}, ${center.x - 100} ${center.y + 91}, ${center.x - 4} ${center.y + 8}`
    const right = `M ${viewport.width + 42} ${center.y - 22} C ${viewport.width * .8} ${center.y + 76}, ${center.x + 102} ${center.y - 92}, ${center.x + 4} ${center.y - 8}`
    return { center, left, right }
  }, [viewport.height, viewport.width])

  if (moment.deferred) return <QuietArrival moment={moment} kind="embrace" />
  return <motion.div className="affection-stage-event affection-stage-embrace" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <svg className="affection-stage-canvas" viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="embrace-left" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#EF8292" stopOpacity="0" /><stop offset=".42" stopColor="#F6A2AC" /><stop offset="1" stopColor="#FFE0C1" /></linearGradient><linearGradient id="embrace-right" x1="1" y1="0" x2="0" y2="0"><stop stopColor="#C47BC1" stopOpacity="0" /><stop offset=".45" stopColor="#E78BA1" /><stop offset="1" stopColor="#FFE0C1" /></linearGradient><radialGradient id="embrace-heart" cx="50%" cy="40%" r="62%"><stop stopColor="#FFF2D8" /><stop offset=".55" stopColor="#F2A29E" /><stop offset="1" stopColor="#B85779" /></radialGradient>{controlMasks.length > 0 && <InteractionExclusionMask id={maskId} viewport={viewport} rects={controlMasks} />}</defs>
      <g mask={controlMasks.length ? `url(#${maskId})` : undefined}>
        <motion.path d={geometry.left} className="embrace-ribbon embrace-ribbon-left" stroke="url(#embrace-left)" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, .16] }} transition={{ duration: reducedMotion ? .01 : 4.16, times: [0, .41, 1], ease: [0.22, .75, .24, 1] }} />
        <motion.path d={geometry.right} className="embrace-ribbon embrace-ribbon-right" stroke="url(#embrace-right)" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, .16] }} transition={{ duration: reducedMotion ? .01 : 4.16, delay: reducedMotion ? 0 : .13, times: [0, .41, 1], ease: [0.22, .75, .24, 1] }} />
        <motion.circle cx={geometry.center.x} cy={geometry.center.y} r="24" className="embrace-pulse" initial={{ opacity: 0, scale: .25 }} animate={{ opacity: [0, 0, .68, .2], scale: [.25, .25, 2.8, 3.55] }} transition={{ duration: reducedMotion ? .01 : 4.12, times: [0, .4, .58, 1], ease: 'easeOut' }} style={{ transformOrigin: `${geometry.center.x}px ${geometry.center.y}px` }} />
        <motion.path d={`M ${geometry.center.x} ${geometry.center.y + 27}C ${geometry.center.x - 5} ${geometry.center.y + 21},${geometry.center.x - 27} ${geometry.center.y + 7},${geometry.center.x - 27} ${geometry.center.y - 9}c0-11,15-16,27-4 12-12,27-7,27 4 0 16-22 30-27 36Z`} fill="url(#embrace-heart)" className="embrace-heart" initial={{ opacity: 0, scale: .35 }} animate={{ opacity: [0, 0, 1, .88, .38], scale: [.35, .35, 1, 1.12, 1.2] }} transition={{ duration: reducedMotion ? .01 : 4.18, times: [0, .4, .54, .73, 1], ease: [0.22, .78, .28, 1] }} style={{ transformOrigin: `${geometry.center.x}px ${geometry.center.y}px` }} />
      </g>
    </svg>
    {controlMasks.length ? <span className="visually-hidden">A warm embrace found you.</span> : <motion.p className="affection-stage-whisper embrace-whisper" initial={{ opacity: 0, y: 5 }} animate={{ opacity: [0, 0, 1, 1, .48], y: [5, 5, 0, 0, -1] }} transition={{ duration: reducedMotion ? .01 : 4.32, times: [0, .51, .61, .81, 1], ease: 'easeOut' }}>A warm embrace found you.</motion.p>}
  </motion.div>
}

function QuietArrival({ moment, kind }: { moment: AffectionMoment; kind: 'thought' | 'embrace' }) {
  return <motion.div className={`affection-memory is-${kind}`} role="status" aria-live="polite" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .28, ease: 'easeOut' }}>
    {kind === 'thought' ? <StarSigil size={18} /> : <HeartVessel />}
    <p>{affectionMomentCopy(moment)}</p>
  </motion.div>
}

export function AffectionStage({ moment, suspended = false }: { moment: AffectionMoment | null; suspended?: boolean }) {
  const reducedMotion = useReducedMotion()
  if (suspended) return null
  // A shortened cinematic sequence otherwise reaches its transparent final keyframe
  // before a reduced-motion user can perceive it. Give those arrivals a tangible,
  // calm keepsake instead of silently changing the sky.
  if (moment && reducedMotion) return <QuietArrival moment={moment} kind={moment.type === 'thinking' ? 'thought' : 'embrace'} />
  return <AnimatePresence mode="wait">{moment && (moment.type === 'thinking' ? <ThoughtArrival key={moment.id} moment={moment} reducedMotion={reducedMotion} /> : <EmbraceArrival key={moment.id} moment={moment} reducedMotion={reducedMotion} />)}</AnimatePresence>
}
