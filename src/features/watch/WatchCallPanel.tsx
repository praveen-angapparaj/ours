import { useCallback } from 'react'
import { Camera, CameraOff, Mic, PhoneOff, Video } from 'lucide-react'
import { StartMediaButton, VideoTrack, useConnectionState, useLocalParticipant, useRemoteParticipants, useTracks } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useCouple } from '../couple/use-couple'
import { useCall } from '../calls/use-call'
import { isLiveCallState } from '../calls/types'
import { useSerializedMediaAction } from '../calls/use-serialized-media-action'

function ActiveWatchCallPanel() {
  const { state, endCall } = useCall()
  const { partner } = useCouple()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant()
  const remoteParticipant = useRemoteParticipants()[0]
  const tracks = useTracks([Track.Source.Camera])
  const connection = useConnectionState()
  const { isBusy, run } = useSerializedMediaAction()
  const isVideo = isLiveCallState(state) && state.call.call_type === 'video'
  const localTrack = tracks.find((track) => track.participant.identity === localParticipant.identity)
  const remoteTrack = remoteParticipant ? tracks.find((track) => track.participant.identity === remoteParticipant.identity) : undefined
  const partnerName = partner?.display_name ?? 'your person'
  const unavailable = isBusy || connection === 'reconnecting' || connection === 'signalReconnecting'

  const toggleMicrophone = useCallback(() => {
    if (unavailable) return
    void run('microphone', () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))
  }, [isMicrophoneEnabled, localParticipant, run, unavailable])

  const toggleCamera = useCallback(() => {
    if (unavailable) return
    void run('camera', () => localParticipant.setCameraEnabled(!isCameraEnabled, {
      facingMode: 'user',
      resolution: { width: 640, height: 480, frameRate: 20 },
    }))
  }, [isCameraEnabled, localParticipant, run, unavailable])

  return <aside className="watch-call-panel" aria-label="Active call controls">
    <StartMediaButton className="watch-call-start-media animated-button tone-yellow" label="TAP TO HEAR CALL" />
    <div className="watch-call-heading"><span className="room-live-dot" /><b>{isVideo ? 'video call still on' : 'voice call still on'}</b><small>{connection === 'connected' ? 'staying with you' : 'reconnecting...'}</small></div>
    {isVideo && <div className="watch-call-video-grid">
      <div className="watch-call-video"><span>{partnerName}</span>{remoteTrack && remoteParticipant?.isCameraEnabled ? <VideoTrack trackRef={remoteTrack} className="video-remote-media" /> : <><CameraOff size={22} /><small>{remoteParticipant ? 'camera off' : 'connecting...'}</small></>}</div>
      <div className="watch-call-video watch-call-self"><span>you</span>{localTrack && isCameraEnabled ? <VideoTrack trackRef={localTrack} className="video-local-media" /> : <><CameraOff size={20} /><small>camera off</small></>}</div>
    </div>}
    <div className="watch-call-actions">
      <button type="button" disabled={unavailable} onClick={toggleMicrophone} aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}>{isMicrophoneEnabled ? <Mic size={17} /> : <Mic size={17} />} {isMicrophoneEnabled ? 'MUTE' : 'UNMUTE'}</button>
      {isVideo && <button type="button" disabled={unavailable} onClick={toggleCamera} aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{isCameraEnabled ? <Camera size={17} /> : <Video size={17} />} {isCameraEnabled ? 'CAMERA OFF' : 'CAMERA ON'}</button>}
      <button type="button" className="watch-call-end" onClick={() => void endCall()}><PhoneOff size={17} /> END</button>
    </div>
  </aside>
}

export function WatchCallPanel() {
  const { state } = useCall()
  if (!isLiveCallState(state) || !state.token || !state.serverUrl) return null
  return <ActiveWatchCallPanel />
}
