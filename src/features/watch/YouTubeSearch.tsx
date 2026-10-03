import { useEffect, useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { searchYouTube, type YouTubeSearchResult } from './youtube-search-service'

type YouTubeSearchProps = {
  onSelect: (videoId: string) => void
  disabled?: boolean
}

export function YouTubeSearch({ onSelect, disabled = false }: YouTubeSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YouTubeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) { setResults([]); setError(null); setSearching(false); return }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearching(true)
      setError(null)
      void searchYouTube(normalized)
        .then((next) => { if (!cancelled) setResults(next) })
        .catch(() => { if (!cancelled) setError('Search is taking a tiny break. You can still paste a link.') })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 450)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query])

  return <section className="youtube-search" aria-label="Search YouTube">
    <label htmlFor="youtube-search-query">Search YouTube</label>
    <div className="youtube-search-input"><Search size={17} /><input id="youtube-search-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="find a video..." autoComplete="off" disabled={disabled} />{searching && <LoaderCircle className="youtube-search-spinner" size={17} />}</div>
    {error && <p className="youtube-search-error">{error}</p>}
    {results.length > 0 && <div className="youtube-search-results">{results.map((result) => <button type="button" key={result.videoId} disabled={disabled} onClick={() => onSelect(result.videoId)}><img src={result.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /><span><b>{result.title}</b><small>{result.channelTitle}</small><em>YOUTUBE</em></span></button>)}</div>}
    {query.trim().length >= 2 && !searching && !error && results.length === 0 && <p className="youtube-search-empty">No playable YouTube results found.</p>}
  </section>
}
