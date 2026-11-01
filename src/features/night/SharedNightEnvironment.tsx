import { memo, useEffect, useState, type CSSProperties } from 'react'
import type { AffectionMomentType } from '../affection/affection-types'

export type NightVisualState = {
  active: boolean
  mode: 'idle' | 'call-ringing' | 'call-connected' | 'watch-idle' | 'watch-playing' | 'watch-paused' | 'watch-with-call' | 'affection'
  moonPhase: number
  moonBrightness: number
  remoteCameraActive: boolean
  reducedMotion: boolean
  affectionType: AffectionMomentType | null
}

type Star = { left: number; top: number; size: number; opacity: number; delay: number; duration: number }
type ShootingStarState = { id: number; left: number; top: number; angle: number; length: number; duration: number }

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function createStars(count: number) {
  const random = seededRandom(90210)
  return Array.from({ length: count }, () => ({
    left: Math.round(random() * 10000) / 100,
    top: Math.round(random() * 10000) / 100,
    size: random() > .9 ? 2.3 : random() > .68 ? 1.45 : .8,
    opacity: .28 + random() * .6,
    delay: Math.round(random() * 800) / 100,
    duration: 2.5 + random() * 5.5,
  }))
}

const stars = createStars(68)

const StarField = memo(function StarField({ reducedMotion }: { reducedMotion: boolean }) {
  return <div className={`night-star-field${reducedMotion ? ' is-still' : ''}`} aria-hidden="true">{stars.map((star, index) => <i key={index} style={{ left: `${star.left}%`, top: `${star.top}%`, width: star.size, height: star.size, opacity: star.opacity, '--star-delay': `${star.delay}s`, '--star-duration': `${star.duration}s` } as CSSProperties} />)}</div>
})

function ShootingStar({ active, reducedMotion, mode }: Pick<NightVisualState, 'active' | 'reducedMotion' | 'mode'>) {
  const [star, setStar] = useState<ShootingStarState | null>(null)

  useEffect(() => {
    if (!active || reducedMotion) { setStar(null); return }
    let cancelled = false
    let timer = 0
    let clearTimer = 0
    const schedule = () => {
      const playing = mode === 'watch-playing'
      const delay = (playing ? 50_000 : 25_000) + Math.round(Math.random() * (playing ? 70_000 : 45_000))
      timer = window.setTimeout(() => {
        if (cancelled) return
        const next: ShootingStarState = { id: Date.now(), left: 12 + Math.random() * 64, top: 7 + Math.random() * 35, angle: 18 + Math.random() * 18, length: 74 + Math.random() * 72, duration: 650 + Math.round(Math.random() * 400) }
        setStar(next)
        clearTimer = window.setTimeout(() => { if (!cancelled) { setStar(null); schedule() } }, next.duration + 140)
      }, delay)
    }
    schedule()
    return () => { cancelled = true; window.clearTimeout(timer); window.clearTimeout(clearTimer) }
  }, [active, mode, reducedMotion])

  if (!star) return null
  return <span key={star.id} className="night-shooting-star" aria-hidden="true" style={{ left: `${star.left}%`, top: `${star.top}%`, '--shot-angle': `${star.angle}deg`, '--shot-length': `${star.length}px`, '--shot-duration': `${star.duration}ms` } as CSSProperties} />
}

function Moon({ phase, brightness }: { phase: number; brightness: number }) {
  const style = { '--moon-phase': String(Math.min(1, Math.max(0, phase))), '--moon-brightness': String(Math.min(1, Math.max(.15, brightness))) } as CSSProperties
  return <div className="night-moon-wrap" style={style} aria-hidden="true"><span className="night-moon-halo halo-far" /><span className="night-moon-halo halo-mid" /><span className="night-moon-halo halo-near" /><span className="night-moon"><i className="moon-crater crater-one" /><i className="moon-crater crater-two" /><i className="moon-crater crater-three" /><b /></span></div>
}

export function SharedNightEnvironment({ state }: { state: NightVisualState }) {
  const className = `shared-night-environment${state.active ? ' is-active' : ''} is-${state.mode}${state.remoteCameraActive ? ' has-remote-camera' : ''}`
  return <div className={className} aria-hidden="true">
    <div className="night-sky-depth" />
    {state.active && <>
      <StarField reducedMotion={state.reducedMotion} />
      <Moon phase={state.moonPhase} brightness={state.moonBrightness} />
      <ShootingStar active reducedMotion={state.reducedMotion} mode={state.mode} />
    </>}
  </div>
}
