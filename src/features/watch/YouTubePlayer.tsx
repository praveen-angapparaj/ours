import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { expectedWatchPosition, type WatchPlaybackState, type WatchSession } from './watch-types'
import { loadYouTubeIframeApi, type YouTubePlayer as YouTubeIframePlayer } from './youtube'

export type YouTubePlayerHandle = {
  seekBy: (seconds: number) => void
  joinPlayback: () => void
}

type YouTubePlayerProps = {
  session: WatchSession
  onIntent: (state: Exclude<WatchPlaybackState, 'empty'>, positionSeconds: number) => void
  onAutoplayBlocked: (blocked: boolean) => void
  onError: (message: string) => void
}

const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 }

function finiteTime(value: number, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function boundedTime(player: YouTubeIframePlayer, value: number) {
  const duration = finiteTime(player.getDuration())
  return duration > 0 ? Math.min(Math.max(0, value), Math.max(0, duration - .05)) : Math.max(0, value)
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer({ session, onIntent, onAutoplayBlocked, onError }, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YouTubeIframePlayer | null>(null)
  const latestSessionRef = useRef(session)
  const appliedVersionRef = useRef(-1)
  const loadedMediaRef = useRef<string | null>(null)
  const suppressUntilRef = useRef(0)
  const lastIntentRef = useRef<{ state: Exclude<WatchPlaybackState, 'empty'>; position: number; at: number } | null>(null)
  const autoplayReportedVersionRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => { latestSessionRef.current = session }, [session])

  const setSuppression = useCallback((milliseconds = 3_500) => {
    suppressUntilRef.current = Math.max(suppressUntilRef.current, Date.now() + milliseconds)
  }, [])

  const emitIntent = useCallback((state: Exclude<WatchPlaybackState, 'empty'>, player: YouTubeIframePlayer) => {
    const position = boundedTime(player, player.getCurrentTime())
    const canonical = latestSessionRef.current
    const expected = boundedTime(player, expectedWatchPosition(canonical))
    // Native iframe controls also emit player events. Do not turn a remote action
    // that we just applied into a second database write. Check this before the
    // temporary guard: a real user click that changes play/pause must never be
    // swallowed merely because a previous remote update was being applied.
    if (canonical.playback_state === state) {
      if (Math.abs(position - expected) < 1.15) return
      if (Date.now() < suppressUntilRef.current) return
    }
    const last = lastIntentRef.current
    if (last && last.state === state && Math.abs(last.position - position) < .75 && Date.now() - last.at < 1_500) return
    lastIntentRef.current = { state, position, at: Date.now() }
    onIntent(state, position)
  }, [onIntent])

  const applyCanonical = useCallback((next: WatchSession, force = false) => {
    const player = playerRef.current
    if (!player || !next.media_id) return
    const target = boundedTime(player, expectedWatchPosition(next))
    const mediaChanged = loadedMediaRef.current !== next.media_id
    const stateChanged = appliedVersionRef.current !== next.state_version
    if (!force && !stateChanged && !mediaChanged) return

    setSuppression()
    loadedMediaRef.current = next.media_id
    appliedVersionRef.current = next.state_version
    if (mediaChanged) {
      if (next.playback_state === 'playing') player.loadVideoById({ videoId: next.media_id, startSeconds: target })
      else player.cueVideoById({ videoId: next.media_id, startSeconds: target })
    } else {
      const current = boundedTime(player, player.getCurrentTime())
      if (force || Math.abs(current - target) > .7) player.seekTo(target, true)
    }

    if (next.playback_state === 'playing') {
      player.playVideo()
      window.setTimeout(() => {
        if (latestSessionRef.current.state_version !== next.state_version || !playerRef.current) return
        if (playerRef.current.getPlayerState() === PLAYER_STATE.PLAYING) { onAutoplayBlocked(false); return }
        if (autoplayReportedVersionRef.current !== next.state_version) {
          autoplayReportedVersionRef.current = next.state_version
          onAutoplayBlocked(true)
        }
      }, 2_000)
    } else {
      player.pauseVideo()
      onAutoplayBlocked(false)
    }
  }, [onAutoplayBlocked, setSuppression])

  useEffect(() => {
    let disposed = false
    let createdPlayer: YouTubeIframePlayer | null = null
    void loadYouTubeIframeApi()
      .then((YT) => {
        if (disposed || !hostRef.current) return
        createdPlayer = new YT.Player(hostRef.current, {
          playerVars: {
            autoplay: 0,
            controls: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              if (disposed) return
              playerRef.current = event.target
              setReady(true)
              applyCanonical(latestSessionRef.current, true)
            },
            onStateChange: (event) => {
              if (disposed) return
              if (event.data === PLAYER_STATE.PLAYING) {
                onAutoplayBlocked(false)
                emitIntent('playing', event.target)
              }
              if (event.data === PLAYER_STATE.PAUSED) emitIntent('paused', event.target)
              if (event.data === PLAYER_STATE.ENDED) emitIntent('ended', event.target)
            },
            onError: () => onError('YouTube could not play this video here. It may be private, unavailable, or block embedding.'),
          },
        })
      })
      .catch(() => { if (!disposed) onError('The YouTube player could not load. Check your connection, then refresh.') })

    return () => {
      disposed = true
      if (playerRef.current === createdPlayer) playerRef.current = null
      createdPlayer?.destroy()
    }
  }, [applyCanonical, emitIntent, onAutoplayBlocked, onError])

  useEffect(() => {
    if (!ready) return
    applyCanonical(session)
  }, [applyCanonical, ready, session])

  useEffect(() => {
    if (!ready) return
    const timer = window.setInterval(() => {
      const player = playerRef.current
      const current = latestSessionRef.current
      if (!player || current.playback_state !== 'playing' || !current.media_id) return
      const expected = boundedTime(player, expectedWatchPosition(current))
      const actual = boundedTime(player, player.getCurrentTime())
      if (Math.abs(actual - expected) > .65) {
        setSuppression(1_800)
        player.seekTo(expected, true)
      }
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [ready, setSuppression])

  useImperativeHandle(ref, () => ({
    seekBy: (seconds) => {
      const player = playerRef.current
      const current = latestSessionRef.current
      if (!player || !current.media_id || current.playback_state === 'empty') return
      const target = boundedTime(player, player.getCurrentTime() + seconds)
      setSuppression()
      player.seekTo(target, true)
      if (current.playback_state === 'playing') player.playVideo()
      else player.pauseVideo()
      onIntent(current.playback_state === 'ended' ? 'paused' : current.playback_state, target)
    },
    joinPlayback: () => {
      const player = playerRef.current
      const current = latestSessionRef.current
      if (!player || current.playback_state !== 'playing') return
      setSuppression()
      player.seekTo(boundedTime(player, expectedWatchPosition(current)), true)
      player.playVideo()
      window.setTimeout(() => {
        if (playerRef.current?.getPlayerState() === PLAYER_STATE.PLAYING) onAutoplayBlocked(false)
      }, 400)
    },
  }), [onAutoplayBlocked, onIntent, setSuppression])

  return <div className="youtube-player-shell" aria-label="Shared YouTube player"><div ref={hostRef} className="youtube-player-host" /></div>
})
