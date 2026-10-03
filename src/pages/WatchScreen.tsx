import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Tv, Volume2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCouple } from '../features/couple/use-couple'
import { WatchCallPanel } from '../features/watch/WatchCallPanel'
import { YouTubePlayer, type YouTubePlayerHandle } from '../features/watch/YouTubePlayer'
import { YouTubeSearch } from '../features/watch/YouTubeSearch'
import { useWatch } from '../features/watch/use-watch'

function playbackCopy(state: 'empty' | 'paused' | 'playing' | 'ended') {
  if (state === 'playing') return 'playing together'
  if (state === 'paused') return 'paused for the plot discussion'
  if (state === 'ended') return 'the credits rolled'
  return 'nothing picked yet'
}

export function WatchScreen() {
  const navigate = useNavigate()
  const { partner } = useCouple()
  const { session, loading, saving, error, realtimeState, setVideo, setPlayback, clearVideo, refresh, clearError } = useWatch()
  const playerRef = useRef<YouTubePlayerHandle | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const partnerName = partner?.display_name ?? 'your person'

  useEffect(() => {
    if (session?.playback_state !== 'playing') setAutoplayBlocked(false)
  }, [session?.playback_state, session?.state_version])

  const chooseVideo = useCallback(async (mediaId: string) => {
    setPlayerError(null)
    try {
      await setVideo(mediaId)
      setChangeOpen(false)
    } catch {
      // The provider exposes the friendly server error in the shared banner.
    }
  }, [setVideo])

  const handleIntent = useCallback((state: 'paused' | 'playing' | 'ended', positionSeconds: number) => {
    setPlayerError(null)
    void setPlayback(state, positionSeconds).catch(() => undefined)
  }, [setPlayback])

  const handlePlayerError = useCallback((message: string) => setPlayerError(message), [])
  const handleAutoplay = useCallback((blocked: boolean) => setAutoplayBlocked(blocked), [])
  const visibleError = playerError ?? error

  if (loading && !session) return <main className="watch-page page-shell"><section className="watch-loading comic-card card-blue"><LoaderCircle className="watch-spinner" /><p className="eyebrow">watch something</p><h1>finding the remote...</h1></section></main>

  return <main className="watch-page page-shell">
    <header className="watch-header">
      <button className="back-button" onClick={() => navigate('/home')}><ArrowLeft size={18} /> <span>back to our mess</span></button>
      <div className="watch-title"><Tv size={16} /><span>watch something</span></div>
      <span className={`watch-sync-state is-${realtimeState}`}><i />{realtimeState === 'connected' ? 'sync is awake' : realtimeState === 'reconnecting' ? 'syncing again...' : 'checking sync...'}</span>
    </header>

    <section className="watch-hero">
      <div><p className="eyebrow">{partnerName} + you, one screen</p><h1>Put something<br /><em>on together.</em></h1><p>Search YouTube, choose a video, and let play, pause, seeking, and tiny plot arguments stay in step.</p></div>
      <div className="watch-note">actual YouTube only.<br />no mysterious pirate ships.</div>
    </section>

    {!session?.media_id ? <section className="watch-picker comic-card card-yellow">
      <div className="watch-picker-copy"><div className="watch-picker-icon"><Tv size={25} /></div><p className="eyebrow">the shared queue is empty</p><h2>What are we pretending to have excellent taste in?</h2><small>Pick an embeddable YouTube video and it appears for both of you.</small></div>
      <YouTubeSearch onSelect={(mediaId) => void chooseVideo(mediaId)} disabled={saving} />
    </section> : <section className={`watch-room${changeOpen ? ' is-changing' : ''}`}>
      <div className="watch-player-card comic-card card-paper">
        <div className="watch-player-topline"><span className="sticker sticker-yellow">YOUTUBE</span><span className={`watch-playback-state is-${session.playback_state}`}><i />{playbackCopy(session.playback_state)}</span></div>
        <YouTubePlayer ref={playerRef} session={session} onIntent={handleIntent} onAutoplayBlocked={handleAutoplay} onError={handlePlayerError} />
        <div className="watch-player-actions">
          <button type="button" onClick={() => playerRef.current?.seekBy(-10)}><ChevronLeft size={19} />10 SEC</button>
          <button type="button" onClick={() => playerRef.current?.seekBy(10)}>10 SEC<ChevronRight size={19} /></button>
          <button type="button" className="watch-change-button" onClick={() => setChangeOpen((open) => !open)}>{changeOpen ? 'NEVER MIND' : 'CHANGE VIDEO'}</button>
          <button type="button" className="watch-clear-button" onClick={() => void clearVideo()}>CLEAR</button>
        </div>
        {autoplayBlocked && <div className="watch-autoplay-card"><Volume2 size={18} /><span>Your browser needs one tap before it can join playback with sound.</span><button type="button" onClick={() => playerRef.current?.joinPlayback()}>TAP TO JOIN</button></div>}
      </div>

      {changeOpen && <aside className="watch-change-panel comic-card card-blue">
        <p className="eyebrow">find something else</p>
        <h2>Change the channel.</h2>
        <YouTubeSearch onSelect={(mediaId) => void chooseVideo(mediaId)} disabled={saving} />
      </aside>}

      <WatchCallPanel />
    </section>}

    {visibleError && <aside className="watch-error" role="alert"><span>{visibleError}</span><button type="button" onClick={() => { setPlayerError(null); clearError(); void refresh().catch(() => undefined) }}><RefreshCw size={14} /> TRY AGAIN</button></aside>}
  </main>
}
