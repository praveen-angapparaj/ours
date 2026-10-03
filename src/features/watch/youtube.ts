export type YouTubePlayerState = {
  ENDED: 0
  PLAYING: 1
  PAUSED: 2
  BUFFERING: 3
  CUED: 5
}

export type YouTubePlayer = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  stopVideo: () => void
}

type YouTubeEvent = { data: number; target: YouTubePlayer }
type YouTubeErrorEvent = { data: number; target: YouTubePlayer }
type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: {
    videoId?: string
    playerVars?: Record<string, number>
    events?: {
      onReady?: (event: YouTubeEvent) => void
      onStateChange?: (event: YouTubeEvent) => void
      onError?: (event: YouTubeErrorEvent) => void
    }
  }) => YouTubePlayer
  PlayerState: YouTubePlayerState
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const youtubeId = /^[A-Za-z0-9_-]{11}$/
let iframeApiPromise: Promise<YouTubeNamespace> | null = null

export function parseYouTubeUrl(rawUrl: string) {
  const candidate = rawUrl.trim()
  if (!candidate) return { mediaId: null, error: 'Paste a YouTube video link first.' }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`)
  } catch {
    return { mediaId: null, error: 'That does not look like a YouTube link.' }
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let mediaId: string | null = null
  if (host === 'youtu.be') mediaId = url.pathname.split('/').filter(Boolean)[0] ?? null
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const segments = url.pathname.split('/').filter(Boolean)
    if (url.pathname === '/watch') mediaId = url.searchParams.get('v')
    if (segments[0] === 'shorts' || segments[0] === 'embed') mediaId = segments[1] ?? null
  }

  if (!mediaId || !youtubeId.test(mediaId)) return { mediaId: null, error: 'Use a normal YouTube watch, short, share, or embed link.' }
  return { mediaId, error: null }
}

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('youtube_player_requires_a_browser'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (iframeApiPromise) return iframeApiPromise

  iframeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    const finish = () => {
      previousReady?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error('youtube_iframe_api_did_not_initialize'))
    }
    window.onYouTubeIframeAPIReady = finish

    const existingScript = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('error', () => reject(new Error('youtube_iframe_api_failed_to_load')), { once: true })
      if (window.YT?.Player) queueMicrotask(finish)
      return
    }

    const script = document.createElement('script')
    script.id = 'youtube-iframe-api'
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('youtube_iframe_api_failed_to_load'))
    document.head.append(script)
  }).catch((error) => {
    iframeApiPromise = null
    throw error
  })

  return iframeApiPromise
}
