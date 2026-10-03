import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Link, LoaderCircle, RefreshCw, Tv, Volume2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCouple } from '../features/couple/use-couple'
import { WatchCallPanel } from '../features/watch/WatchCallPanel'
import { YouTubePlayer, type YouTubePlayerHandle } from '../features/watch/YouTubePlayer'
import { YouTubeSearch } from '../features/watch/YouTubeSearch'
import { parseYouTubeUrl } from '../features/watch/youtube'
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
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const partnerName = partner?.display_name ?? 'your person'

  useEffect(() => {
    if (session?.playback_state !== 'playing') setAutoplayBlocked(false)
  }, [session?.playback_state, session?.state_version])

  const chooseVideo = useCallback(async (mediaId: string) => {
    setUrlError(null)
    setPlayerError(null)
    try {
      await setVideo(mediaId)
      setUrl('')
      setChangeOpen(false)
    } catch {
      // The provider exposes the friendly server error in the shared banner.
    }
  }, [setVideo])

  const submitVideo = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseYouTubeUrl(url)
    if (!parsed.mediaId) { setUrlError(parsed.error); return }
    await chooseVideo(parsed.mediaId)
  }, [chooseVideo, url])

  const handleIntent = useCallback((state: 'paused' | 'playing' | 'ended', positionSeconds: number) => {
    setPlayerError(null)
    void setPlayback(state, positionSeconds).catch(() => undefined)
  }, [setPlayback])

  const handlePlayerError = useCallback((message: string) => setPlayerError(message), [])
  const handleAutoplay = useCallback((blocked: boolean) => setAutoplayBlocked(blocked), [])
  const visibleError = urlError ?? playerError ?? error

  if (loading && !session) return <main className="watch-page page-shell"><section className="watch-loading comic-card card-blue"><LoaderCircle className="watch-spinner" /><p className="eyebrow">watch something</p><h1>finding the remote...</h1></section></main>

  return <main className="watch-page page-shell">
    <header className="watch-header">
      <button className="back-button" onClick={() => navigate('/home')}><ArrowLeft size={18} /> <span>back to our mess</span></button>
      <div className="watch-title"><Tv size={16} /><span>watch something</span></div>
      <span className={`watch-sync-state is-${realtimeState}`}><i />{realtimeState === 'connected' ? 'sync is awake' : realtimeState === 'reconnecting' ? 'syncing again...' : 'checking sync...'}</span>
    </header>

    <section className="watch-hero">
      <div><p className="eyebrow">{partnerName} + you, one screen</p><h1>Put something<br /><em>on together.</em></h1><p>Paste a YouTube link. Play, pause, seeking, and the tiny plot arguments stay in step.</p></div>
      <div className="watch-note">actual YouTube only.<br />no mysterious pirate ships.</div>
    </section>

    {!session?.media_id ? <section className="watch-picker comic-card card-yellow">
      <div className="watch-picker-icon"><Link size={25} /></div>
      <p className="eyebrow">the shared queue is empty</p><h2>What are we pretending to have excellent taste in?</h2>
      <form className="watch-url-form" onSubmit={submitVideo}>
        <label htmlFor="youtube-url">YouTube link</label>
        <input id="youtube-url" value={url} onChange={(event) => { setUrl(event.target.value); setUrlError(null); clearError() }} placeholder="https://youtu.be/..." inputMode="url" autoComplete="url" />
        <button className="animated-button tone-coral" type="submit" disabled={saving}>{saving ? 'ADDING...' : 'WATCH THIS'}</button>
      </form>
      <YouTubeSearch onSelect={(mediaId) => void chooseVideo(mediaId)} disabled={saving} />
      <small>Works with watch, short, share, and embed links. The video still has to allow embedding.</small>
    </section> : <section className="watch-room">
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

      {changeOpen && <form className="watch-change-form comic-card card-blue" onSubmit={submitVideo}>
        <label htmlFor="youtube-url-change">A different YouTube link</label>
        <input id="youtube-url-change" value={url} onChange={(event) => { setUrl(event.target.value); setUrlError(null); clearError() }} placeholder="https://www.youtube.com/watch?v=..." inputMode="url" autoComplete="url" autoFocus />
        <button className="animated-button tone-yellow" type="submit" disabled={saving}>{saving ? 'SAVING...' : 'SWAP VIDEO'}</button>
        <YouTubeSearch onSelect={(mediaId) => void chooseVideo(mediaId)} disabled={saving} />
      </form>}

      <WatchCallPanel />
    </section>}

    {visibleError && <aside className="watch-error" role="alert"><span>{visibleError}</span><button type="button" onClick={() => { setUrlError(null); setPlayerError(null); clearError(); void refresh().catch(() => undefined) }}><RefreshCw size={14} /> TRY AGAIN</button></aside>}
  </main>
}
