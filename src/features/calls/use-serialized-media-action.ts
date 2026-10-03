import { useCallback, useEffect, useRef, useState } from 'react'

export type MediaAction = 'microphone' | 'camera' | 'camera-flip'

// LiveKit deliberately waits for a pending publication before changing a track.
// Keep every local-media change in one lane so a second tap cannot overlap it.
export function useSerializedMediaAction() {
  const [activeAction, setActiveAction] = useState<MediaAction | null>(null)
  const activeTokenRef = useRef<symbol | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const run = useCallback(async (action: MediaAction, operation: () => Promise<unknown>) => {
    if (activeTokenRef.current) return false
    const token = Symbol(action)
    activeTokenRef.current = token
    setActiveAction(action)
    try {
      await operation()
      return true
    } finally {
      if (activeTokenRef.current === token) {
        activeTokenRef.current = null
        if (mountedRef.current) setActiveAction(null)
      }
    }
  }, [])

  return { activeAction, isBusy: activeAction !== null, run }
}
