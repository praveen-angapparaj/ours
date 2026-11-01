import { createContext, useContext, type ReactNode } from 'react'

// Screens can render while the media bundle is loading. Keeping that state
// separate from CallProvider prevents a Suspense fallback from replacing the
// whole application or accidentally calling LiveKit hooks without a room.
const CallMediaReadyContext = createContext(false)

export function CallMediaReadyProvider({ ready, children }: { ready: boolean; children: ReactNode }) {
  return <CallMediaReadyContext.Provider value={ready}>{children}</CallMediaReadyContext.Provider>
}

export function useCallMediaReady() {
  return useContext(CallMediaReadyContext)
}
