import type { ReactNode } from 'react'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import { useCall } from './use-call'
import { isLiveCallState } from './types'
import { NightRemoteMediaBridge } from '../night/NightRemoteMediaBridge'

// The LiveKit room belongs to the active call, not to the /room page. Keeping
// it here lets audio/video continue while a paired couple visits /watch.
export function CallMediaProvider({ children }: { children: ReactNode }) {
  const { state, markRoomConnected, reportRoomConnectionError, reportRoomDisconnected } = useCall()
  const liveSession = isLiveCallState(state) ? state : null
  const connectionError = liveSession?.status === 'connecting' ? liveSession.connectionError : undefined

  if (!liveSession || connectionError || !liveSession.token || !liveSession.serverUrl) return <>{children}</>

  const { call, token, serverUrl, attempt } = liveSession
  return <LiveKitRoom
    key={`${call.id}:${attempt}`}
    token={token}
    serverUrl={serverUrl}
    connect
    audio={false}
    video={false}
    options={{
      disconnectOnPageLeave: true,
      stopLocalTrackOnUnpublish: true,
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: { width: 640, height: 480, frameRate: 20 } },
    }}
    onConnected={() => markRoomConnected(call.id, attempt)}
    onError={(error) => reportRoomConnectionError(call.id, attempt, error)}
    onDisconnected={(reason) => reportRoomDisconnected(call.id, attempt, reason)}
  >
    <RoomAudioRenderer />
    <NightRemoteMediaBridge />
    {children}
  </LiveKitRoom>
}
