import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, MessageCircle, Mic, PhoneCall, PhoneOff, Video } from 'lucide-react'
import { StartMediaButton, VideoTrack, useConnectionState, useLocalParticipant, useRemoteParticipants, useTracks } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useCouple } from '../couple/use-couple'
import { useCall } from '../calls/use-call'
import { isLiveCallState } from '../calls/types'
import { useSerializedMediaAction } from '../calls/use-serialized-media-action'
import { useCallMediaReady } from '../calls/call-media-state'

type WatchCallPanelProps = { chatOpen: boolean; onToggleChat: () => void }

function WatchTogetherModes({ chatOpen, onToggleChat }: WatchCallPanelProps) {
  const { startCall, state } = useCall()
  const starting = state.status !== 'idle'

  return <aside className="watch-call-panel watch-call-modes" aria-label="Ways to be together while watching">
    <div className="watch-call-heading"><span className="watch-call-heading-icon"><PhoneCall size={16} /></span><span><b>Watch with your person</b><small>Talk, see each other, or send a thought.</small></span></div>
    <div className="watch-call-mode-actions">
      <button type="button" disabled={starting} onClick={() => void startCall('audio')}><Mic size={16} />VOICE</button>
      <button type="button" disabled={starting} onClick={() => void startCall('video')}><Video size={16} />VIDEO</button>
      <button type="button" className={chatOpen ? 'is-active' : ''} onClick={onToggleChat}><MessageCircle size={16} />CHAT</button>
    </div>
  </aside>
}

function ActiveWatchCallPanel({ chatOpen, onToggleChat }: WatchCallPanelProps) {
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
  const initialMediaStartedRef = useRef(false)
  const [mediaIssue, setMediaIssue] = useState<string | null>(null)

  const enableMicrophone = useCallback(async () => {
    if (isMicrophoneEnabled) return
    try {
      await run('microphone', () => localParticipant.setMicrophoneEnabled(true))
      setMediaIssue(null)
    } catch {
      setMediaIssue('Microphone needs permission. You can try the mute button again.')
    }
  }, [isMicrophoneEnabled, localParticipant, run])

  const enableCamera = useCallback(async () => {
    if (!isVideo || isCameraEnabled) return
    try {
      await run('camera', () => localParticipant.setCameraEnabled(true, {
        facingMode: 'user',
        resolution: { width: 640, height: 480, frameRate: 20 },
      }))
      setMediaIssue(null)
    } catch {
      setMediaIssue('Camera needs permission. You can try its button again.')
    }
  }, [isCameraEnabled, isVideo, localParticipant, run])

  useEffect(() => {
    if (connection !== 'connected' || initialMediaStartedRef.current) return
    initialMediaStartedRef.current = true
    void (async () => {
      await enableMicrophone()
      await enableCamera()
    })()
  }, [connection, enableCamera, enableMicrophone])

  const toggleMicrophone = useCallback(() => {
    if (unavailable) return
    void run('microphone', () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)).then(() => setMediaIssue(null)).catch(() => setMediaIssue('Microphone needs permission. You can try again.'))
  }, [isMicrophoneEnabled, localParticipant, run, unavailable])

  const toggleCamera = useCallback(() => {
    if (unavailable) return
    void run('camera', () => localParticipant.setCameraEnabled(!isCameraEnabled, {
      facingMode: 'user',
      resolution: { width: 640, height: 480, frameRate: 20 },
    })).then(() => setMediaIssue(null)).catch(() => setMediaIssue('Camera needs permission. You can try again.'))
  }, [isCameraEnabled, localParticipant, run, unavailable])

  return <aside className={`watch-call-panel${isVideo ? ' is-video-call' : ' is-voice-call'}`} aria-label="Active call controls">
    <StartMediaButton className="watch-call-start-media animated-button tone-yellow" label="TAP TO HEAR CALL" />
    <div className="watch-call-heading"><span className="room-live-dot" /><span><b>{isVideo ? 'Video call' : 'Voice call'}</b><small>{connection === 'connected' ? 'staying in the watch room' : 'reconnecting...'}</small></span></div>
    {isVideo && <div className="watch-call-video-grid">
      <div className="watch-call-video"><span>{partnerName}</span>{remoteTrack && remoteParticipant?.isCameraEnabled ? <VideoTrack trackRef={remoteTrack} className="video-remote-media" /> : <><CameraOff size={22} /><small>{remoteParticipant ? 'camera off' : 'connecting...'}</small></>}</div>
      <div className="watch-call-video watch-call-self"><span>you</span>{localTrack && isCameraEnabled ? <VideoTrack trackRef={localTrack} className="video-local-media" /> : <><CameraOff size={20} /><small>camera off</small></>}</div>
    </div>}
    {mediaIssue && <p className="watch-call-media-issue" role="status">{mediaIssue}</p>}
    <div className="watch-call-actions">
      <button type="button" disabled={unavailable} onClick={toggleMicrophone} aria-label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}><Mic size={17} />{isMicrophoneEnabled ? 'MUTE' : 'UNMUTE'}</button>
      {isVideo && <button type="button" disabled={unavailable} onClick={toggleCamera} aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{isCameraEnabled ? <Camera size={17} /> : <Video size={17} />}{isCameraEnabled ? 'CAMERA OFF' : 'CAMERA ON'}</button>}
      <button type="button" className={chatOpen ? 'watch-call-chat is-active' : 'watch-call-chat'} onClick={onToggleChat}><MessageCircle size={17} />CHAT</button>
      <button type="button" className="watch-call-end" onClick={() => void endCall()}><PhoneOff size={17} />END CALL</button>
    </div>
  </aside>
}

export function WatchCallPanel(props: WatchCallPanelProps) {
  const { state } = useCall()
  const mediaReady = useCallMediaReady()
  if (!isLiveCallState(state) || !state.token || !state.serverUrl) return <WatchTogetherModes {...props} />
  if (!mediaReady) return <aside className="watch-call-panel watch-call-modes" aria-live="polite"><div className="watch-call-heading"><span className="room-live-dot" /><span><b>Connecting your call</b><small>Your watch room is staying open.</small></span></div></aside>
  return <ActiveWatchCallPanel {...props} />
}
