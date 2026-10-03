import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, Maximize2, Minimize2, RefreshCw, Search, Tv, Volume2, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WatchCallPanel } from '../features/watch/WatchCallPanel'
import { WatchChatPanel } from '../features/watch/WatchChatPanel'
import { YouTubePlayer, type YouTubePlayerHandle } from '../features/watch/YouTubePlayer'
import { WatchPlayerErrorBoundary } from '../features/watch/WatchPlayerErrorBoundary'
import { YouTubeSearch } from '../features/watch/YouTubeSearch'
import type { YouTubeSearchCategory } from '../features/watch/youtube-search-service'
import { useWatch } from '../features/watch/use-watch'
import { useNightEnvironment } from '../features/night/NightEnvironmentProvider'

function playbackCopy(state: 'empty' | 'paused' | 'playing' | 'ended') {
  if (state === 'playing') return 'playing together'
  if (state === 'paused') return 'paused'
  if (state === 'ended') return 'finished'
  return 'ready when you are'
}

export function WatchScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, loading, saving, error, realtimeState, setVideo, setPlayback, clearVideo, refresh, clearError } = useWatch()
  const { setWatchActivity } = useNightEnvironment()
  const playerRef = useRef<YouTubePlayerHandle | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [searchOpen, setSearchOpen] = useState(true)
  const [searchCategory, setSearchCategory] = useState<YouTubeSearchCategory>(() => searchParams.get('category') === 'music' ? 'music' : 'video')
  const [chatOpen, setChatOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [playerAttempt, setPlayerAttempt] = useState(0)

  useEffect(() => {
    if (session?.playback_state !== 'playing') setAutoplayBlocked(false)
  }, [session?.playback_state, session?.state_version])

  const chooseVideo = useCallback(async (mediaId: string) => {
    setPlayerError(null)
    try {
      await setVideo(mediaId)
    } catch {
      // The provider exposes the friendly server error in the shared banner.
    }
  }, [setVideo])

  const handleIntent = useCallback((state: 'paused' | 'playing' | 'ended', positionSeconds: number) => {
    setPlayerError(null)
    void setPlayback(state, positionSeconds).catch(() => undefined)
  }, [setPlayback])

  const visibleError = playerError ?? error
  const hasVideo = Boolean(session?.media_id)

  useEffect(() => {
    setWatchActivity({ active: true, hasMedia: hasVideo, playbackState: session?.playback_state ?? 'empty' })
    return () => setWatchActivity({ active: false, hasMedia: false, playbackState: 'empty' })
  }, [hasVideo, session?.playback_state, setWatchActivity])

  if (loading && !session) return <main className="watch-page page-shell"><section className="watch-loading comic-card card-blue"><LoaderCircle className="watch-spinner" /><p className="eyebrow">watch together</p><h1>Getting the room ready.</h1></section></main>

  return <main className={`watch-page watch-page-hub page-shell${focusMode ? ' is-focus-mode' : ''}`}>
    <header className="watch-header watch-hub-header">
      <button className="back-button" onClick={() => navigate('/home')}><ArrowLeft size={18} /> <span>back home</span></button>
      <div className="watch-title"><Tv size={16} /><span>watch together</span></div>
      <span className={`watch-sync-state is-${realtimeState}`}><i />{realtimeState === 'connected' ? 'in sync' : realtimeState === 'reconnecting' ? 'syncing...' : 'connecting...'}</span>
    </header>

    <section className={`watch-workspace${searchOpen ? ' has-search' : ''}${chatOpen ? ' has-chat' : ''}${focusMode ? ' is-focus' : ''}`} aria-label="Watch together room">
      <section className="watch-stage">
        <div className="watch-stage-topline"><span>{searchCategory === 'music' ? 'LISTEN TOGETHER' : 'WATCH TOGETHER'}</span>{hasVideo && session && <span className={`watch-playback-state is-${session.playback_state}`}><i />{playbackCopy(session.playback_state)}</span>}</div>
        {hasVideo && session ? <div className="watch-player-card comic-card card-paper">
          <WatchPlayerErrorBoundary key={`${session.media_id}:${playerAttempt}`} fallback={<div className="watch-empty-stage" role="alert"><Tv size={35} /><p>The player hit a snag.</p><small>Try loading it again. Your shared video choice is still saved.</small><button type="button" className="animated-button tone-yellow" onClick={() => setPlayerAttempt((current) => current + 1)}>RETRY PLAYER</button></div>}>
            <YouTubePlayer ref={playerRef} session={session} onIntent={handleIntent} onAutoplayBlocked={setAutoplayBlocked} onError={setPlayerError} />
          </WatchPlayerErrorBoundary>
          <div className="watch-player-actions">
            <button type="button" onClick={() => playerRef.current?.seekBy(-10)}><ChevronLeft size={19} />10 SEC</button>
            <button type="button" onClick={() => playerRef.current?.seekBy(10)}>10 SEC<ChevronRight size={19} /></button>
            <button type="button" className="watch-focus-button" onClick={() => setFocusMode((current) => !current)}>{focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}{focusMode ? 'EXIT FOCUS' : 'FOCUS VIEW'}</button>
            <button type="button" className="watch-clear-button" onClick={() => void clearVideo()} disabled={saving}>CLEAR</button>
          </div>
          {autoplayBlocked && <div className="watch-autoplay-card"><Volume2 size={18} /><span>Your browser needs one tap before it can join playback with sound.</span><button type="button" onClick={() => playerRef.current?.joinPlayback()}>TAP TO JOIN</button></div>}
        </div> : <div className="watch-empty-stage"><Tv size={35} /><p>Choose something on the right.</p><small>The screen will stay in sync for both of you.</small></div>}
      </section>

      <aside className="watch-side-rail">
        <WatchCallPanel chatOpen={chatOpen} onToggleChat={() => setChatOpen((current) => !current)} />
        {chatOpen && <WatchChatPanel onClose={() => setChatOpen(false)} />}
        {searchOpen ? <section className="watch-search-panel" aria-label="Video search">
          <header><span><Search size={15} />Find something</span><button type="button" onClick={() => setSearchOpen(false)} aria-label="Hide video search"><X size={16} /></button></header>
          <div className="watch-search-category" role="group" aria-label="Search category"><button type="button" className={searchCategory === 'video' ? 'is-active' : ''} aria-pressed={searchCategory === 'video'} onClick={() => setSearchCategory('video')}>VIDEOS</button><button type="button" className={searchCategory === 'music' ? 'is-active' : ''} aria-pressed={searchCategory === 'music'} onClick={() => setSearchCategory('music')}>MUSIC</button></div>
          <YouTubeSearch onSelect={(mediaId) => void chooseVideo(mediaId)} disabled={saving} category={searchCategory} />
        </section> : <button type="button" className="watch-show-search" onClick={() => setSearchOpen(true)}><Search size={17} />SEARCH VIDEOS</button>}
      </aside>
    </section>

    {visibleError && <aside className="watch-error" role="alert"><span>{visibleError}</span><button type="button" onClick={() => { setPlayerError(null); clearError(); void refresh().catch(() => undefined) }}><RefreshCw size={14} />TRY AGAIN</button></aside>}
  </main>
}
