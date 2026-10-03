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

let iframeApiPromise: Promise<YouTubeNamespace> | null = null

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
