import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { friendlyAffectionError, newAffectionClientEventId } from './affection-service'
import { HeartVessel, StarSigil } from './AffectionIllustrations'
import { LoveLetterStudio } from './LoveLetterStudio'
import { useAffection } from './use-affection'

type Flight = { id: string; origin: { x: number; y: number }; result: 'pending' | 'accepted' | 'failed' }

const STAR_FLIGHT_SECONDS = 1.74
const STAR_ARRIVAL_DELAY_SECONDS = 1.34
const STAR_FLIGHT_CLEAR_MS = 2_600

function cubicPoint(t: number, start: { x: number; y: number }, one: { x: number; y: number }, two: { x: number; y: number }, end: { x: number; y: number }) {
  const inverse = 1 - t
  return { x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * one.x + 3 * inverse * t ** 2 * two.x + t ** 3 * end.x, y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * one.y + 3 * inverse * t ** 2 * two.y + t ** 3 * end.y }
}

function SenderStarFlight({ flight }: { flight: Flight }) {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  useEffect(() => {
    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  const trajectory = useMemo(() => {
    const sharedStar = document.querySelector<HTMLElement>('.orbit-body-together')
    const sharedStarRect = sharedStar?.getBoundingClientRect()
    const end = sharedStarRect && sharedStarRect.width > 0 && sharedStarRect.height > 0
      ? { x: sharedStarRect.left + sharedStarRect.width / 2, y: sharedStarRect.top + sharedStarRect.height / 2 }
      : { x: Math.min(viewport.width * .44, viewport.width - 72), y: Math.max(92, viewport.height * .36) }
    const lift = Math.min(240, Math.max(128, Math.abs(flight.origin.y - end.y) * .62))
    const one = { x: Math.min(viewport.width - 38, flight.origin.x + Math.min(88, viewport.width * .08)), y: Math.max(54, flight.origin.y - lift) }
    const two = { x: end.x + Math.min(236, Math.abs(flight.origin.x - end.x) * .42), y: Math.max(50, end.y - lift * .46) }
    const points = Array.from({ length: 7 }, (_, index) => cubicPoint(index / 6, flight.origin, one, two, end))
    const launchZone = document.querySelector<HTMLElement>('.home-actions-zone')?.getBoundingClientRect()
    const mask = launchZone && launchZone.width > 0 && launchZone.height > 0
      ? { x: launchZone.left - 2, y: launchZone.top - 2, width: launchZone.width + 4, height: launchZone.height + 4 }
      : null
    return { end, points, mask, d: `M ${flight.origin.x} ${flight.origin.y} C ${one.x} ${one.y}, ${two.x} ${two.y}, ${end.x} ${end.y}` }
  }, [flight.origin, viewport.height, viewport.width])
  const failed = flight.result === 'failed'
  const maskId = `outbound-star-mask-${flight.id}`
  return <div className="affection-outbound-flight" aria-hidden="true"><svg viewBox={`0 0 ${viewport.width} ${viewport.height}`} preserveAspectRatio="none"><defs>{trajectory.mask && <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={viewport.width} height={viewport.height}><rect x="0" y="0" width={viewport.width} height={viewport.height} fill="#fff" /><rect x={trajectory.mask.x} y={trajectory.mask.y} width={trajectory.mask.width} height={trajectory.mask.height} fill="#000" /></mask>}</defs><g mask={trajectory.mask ? `url(#${maskId})` : undefined}><motion.path d={trajectory.d} className={`outbound-star-trail${failed ? ' is-failed' : ''}`} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: failed ? [.05, .42, .42] : [0, .94, 1], opacity: failed ? [0, .55, 0] : [0, .76, .34, 0] }} transition={{ duration: failed ? .72 : STAR_FLIGHT_SECONDS, times: failed ? [0, .62, 1] : [0, .16, .76, 1], ease: [0.22, .8, .28, 1] }} /><motion.g initial={{ x: flight.origin.x, y: flight.origin.y, scale: .45, opacity: 0 }} animate={{ x: failed ? trajectory.points.slice(0, 4).map((point) => point.x) : trajectory.points.map((point) => point.x), y: failed ? trajectory.points.slice(0, 4).map((point) => point.y) : trajectory.points.map((point) => point.y), scale: failed ? [.45, .9, .52, .18] : [.45, 1, .88, .5, .2], opacity: failed ? [0, 1, .62, 0] : [0, 1, 1, .82, 0] }} transition={{ duration: failed ? .75 : STAR_FLIGHT_SECONDS, times: failed ? [0, .18, .72, 1] : [0, .14, .62, .82, 1], ease: [0.22, .8, .28, 1] }}><circle r="18" className="outbound-star-glow" /><path d="M0 -11C1.3 -3 3 -1.3 11 0 3 1.3 1.3 3 0 11-1.3 3-3 1.3-11 0-3-1.3-1.3-3 0-11Z" className="outbound-star-core" /></motion.g>{flight.result === 'accepted' && <motion.g initial={{ opacity: 0, scale: .3 }} animate={{ opacity: [0, 1, .76, 0], scale: [.3, .9, 1.3, 1.72] }} transition={{ delay: STAR_ARRIVAL_DELAY_SECONDS, duration: .76, ease: 'easeOut' }} style={{ transformOrigin: `${trajectory.end.x}px ${trajectory.end.y}px` }}><circle cx={trajectory.end.x} cy={trajectory.end.y} r="18" className="outbound-star-arrival" /><path d={`M ${trajectory.end.x} ${trajectory.end.y - 8}V${trajectory.end.y + 8}M ${trajectory.end.x - 8} ${trajectory.end.y}H${trajectory.end.x + 8}`} className="outbound-star-arrival" /></motion.g>}</g></svg></div>
}

function TravelingStarControl({ partnerName }: { partnerName: string }) {
  const { sendMoment } = useAffection()
  const [pending, setPending] = useState(false)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const clientEventId = useRef<string | null>(null)
  const clearFlight = useRef<number | null>(null)

  useEffect(() => () => { if (clearFlight.current !== null) window.clearTimeout(clearFlight.current) }, [])

  const send = useCallback(async (target: HTMLElement) => {
    if (pending || flight) return
    if (clearFlight.current !== null) window.clearTimeout(clearFlight.current)
    const rect = target.getBoundingClientRect()
    const id = clientEventId.current ?? newAffectionClientEventId()
    clientEventId.current = id
    setPending(true)
    setFeedback(null)
    setFlight({ id, origin: { x: rect.left + rect.width * .52, y: rect.top + rect.height * .36 }, result: 'pending' })
    try {
      await sendMoment('thinking', id)
      clientEventId.current = null
      setFlight((current) => current?.id === id ? { ...current, result: 'accepted' } : current)
      setFeedback(`A small star has left for ${partnerName}.`)
      clearFlight.current = window.setTimeout(() => setFlight((current) => current?.id === id ? null : current), STAR_FLIGHT_CLEAR_MS)
    } catch (error) {
      setFlight((current) => current?.id === id ? { ...current, result: 'failed' } : current)
      setFeedback(friendlyAffectionError(error))
      clearFlight.current = window.setTimeout(() => setFlight((current) => current?.id === id ? null : current), 1_000)
    } finally {
      setPending(false)
    }
  }, [flight, partnerName, pending, sendMoment])

  return <div className="dock-gesture dock-traveling-star">
    <motion.button type="button" className="dock-star-control" onClick={(event: MouseEvent<HTMLButtonElement>) => void send(event.currentTarget)} disabled={pending || Boolean(flight)} whileTap={{ scale: .92 }} aria-describedby="traveling-star-help">
      <span className="dock-star-orb"><StarSigil size={27} /></span><span><b>Send a thought</b><small>{pending ? 'finding its way' : `to ${partnerName}`}</small></span>
    </motion.button>
    <span id="traveling-star-help" className="visually-hidden">Send a small star to let your person know you are thinking of them.</span>
    {feedback && <p className="dock-feedback" role="status">{feedback}</p>}
    {flight && <SenderStarFlight flight={flight} />}
  </div>
}

const EMBRACE_READY_MS = 1_600

function WarmEmbraceControl({ partnerName }: { partnerName: string }) {
  const { sendMoment } = useAffection()
  const [holding, setHolding] = useState(false)
  const [pending, setPending] = useState(false)
  const [release, setRelease] = useState<'idle' | 'warm' | 'sent' | 'failed'>('idle')
  const [feedback, setFeedback] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const pointerId = useRef<number | null>(null)
  const startedAt = useRef(0)
  const animationFrame = useRef<number | null>(null)
  const releaseTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const clientEventId = useRef<string | null>(null)

  const paintCharge = useCallback((amount: number) => buttonRef.current?.style.setProperty('--embrace-charge', String(amount)), [])
  const resetHold = useCallback(() => {
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
    animationFrame.current = null
    pointerId.current = null
    paintCharge(0)
    setHolding(false)
  }, [paintCharge])
  useEffect(() => () => {
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current)
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current)
  }, [])

  const send = useCallback(async () => {
    if (pending) return
    const id = clientEventId.current ?? newAffectionClientEventId()
    clientEventId.current = id
    setPending(true)
    setRelease('warm')
    setFeedback(null)
    try {
      await sendMoment('hug', id)
      clientEventId.current = null
      setRelease('sent')
      setFeedback(`Your warmth is on its way to ${partnerName}.`)
    } catch (error) {
      setRelease('failed')
      setFeedback(friendlyAffectionError(error))
    } finally {
      setPending(false)
      if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current)
      releaseTimer.current = window.setTimeout(() => setRelease('idle'), 1_100)
    }
  }, [partnerName, pending, sendMoment])

  const begin = (event: PointerEvent<HTMLButtonElement>) => {
    if (pending || release !== 'idle' || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointerId.current = event.pointerId
    startedAt.current = performance.now()
    event.currentTarget.setPointerCapture(event.pointerId)
    setHolding(true)
    setRelease('idle')
    const tick = (now: number) => {
      const amount = Math.min(1, (now - startedAt.current) / EMBRACE_READY_MS)
      paintCharge(amount)
      if (pointerId.current !== null && amount < 1) animationFrame.current = window.requestAnimationFrame(tick)
    }
    animationFrame.current = window.requestAnimationFrame(tick)
  }

  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
    resetHold()
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12)
    void send()
  }

  const cancel = () => resetHold()
  const click = () => { if (!suppressClick.current && release === 'idle') void send() }

  return <div className="dock-gesture dock-warm-embrace">
    <motion.button ref={buttonRef} type="button" className={`dock-embrace-control${holding ? ' is-holding' : ''} is-${release}`} onPointerDown={begin} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={click} disabled={pending || release !== 'idle'} whileTap={{ scale: .96 }} aria-describedby="warm-embrace-help">
      <span className="embrace-illustration"><i className="embrace-ring ring-one" /><i className="embrace-ring ring-two" /><i className="embrace-arc arc-left" /><i className="embrace-arc arc-right" /><HeartVessel /></span><span><b>Warm embrace</b><small>{holding ? 'hold the warmth' : pending ? 'letting it travel' : 'press or hold'}</small></span>
    </motion.button>
    <span id="warm-embrace-help" className="visually-hidden">Press and hold to gather a warm embrace, then release to send it. A short tap also sends one hug.</span>
    {feedback && <p className="dock-feedback" role="status">{feedback}</p>}
  </div>
}

export function AffectionDock({ partnerName }: { partnerName: string }) {
  return <section className="affection-dock" aria-label="Small things that travel between you">
    <div className="affection-dock-heading"><span>LEAVE A LITTLE LIGHT</span><i aria-hidden="true" /></div>
    <div className="affection-dock-gestures"><TravelingStarControl partnerName={partnerName} /><WarmEmbraceControl partnerName={partnerName} /><LoveLetterStudio partnerName={partnerName} /></div>
  </section>
}
