import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CameraOff } from 'lucide-react'
import { StartMediaButton, VideoTrack, useConnectionState, useLocalParticipant, useRemoteParticipants, useTracks } from '@livekit/components-react'
import { MediaDeviceFailure, Track } from 'livekit-client'
import { CallControls } from '../../components/room/CallControls'
import { useCouple } from '../couple/use-couple'
import { profileInitials } from '../couple/profile-initials'
import { useCall } from './use-call'
import { CallRoomErrorBoundary } from './CallRoomErrorBoundary'
import type { LiveCallRuntimeState } from './types'
import { useSerializedMediaAction } from './use-serialized-media-action'

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainingSeconds = seconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function CallDuration({ answeredAt }: { answeredAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  const answered = answeredAt ? Date.parse(answeredAt) : now
  const duration = formatDuration(Math.max(0, Math.floor((now - answered) / 1_000)))
  return <div className="video-call-meta"><b aria-label={`Call duration ${duration}`}>{duration}</b><span>somehow still talking.</span></div>
}

function mediaMessage(error: unknown, device: 'camera' | 'microphone') {
  const failure = typeof error === 'string'
    ? error as MediaDeviceFailure
    : error instanceof Error ? MediaDeviceFailure.getFailure(error) : undefined
  if (failure === MediaDeviceFailure.PermissionDenied) return `${device} permission is off. enable it in your browser settings.`
  if (failure === MediaDeviceFailure.NotFound) return `no ${device} was found.`
  if (failure === MediaDeviceFailure.DeviceInUse) return `your ${device} is busy in another app.`
  return `the ${device} could not start. try again.`
}

function CameraPlaceholder({ name, copy, self = false }: { name: string, copy: string, self?: boolean }) {
  return <div className={`video-placeholder${self ? ' video-placeholder-self' : ''}`}>
    <span className="video-placeholder-avatar">{self ? ':)' : profileInitials(name, 'M')}</span>
    <CameraOff size={26} aria-hidden="true" />
    <strong>{self ? 'camera off' : `${name}’s camera vanished.`}</strong>
    <p>{copy}</p>
  </div>
}

function VideoCallProblem({ message }: { message: string }) {
  const { endCall, retryConnection } = useCall()
  return <main className="call-connecting page-shell">
    <section className="call-connecting-card">
      <p className="eyebrow">video call hiccup</p>
      <h1>{message}</h1>
      <p>check your microphone or connection, then give it another go.</p>
      <div className="call-problem-actions"><button className="animated-button tone-yellow" onClick={retryConnection}>TRY AGAIN</button><button className="animated-button tone-coral" onClick={() => void endCall()}>END CALL</button></div>
    </section>
  </main>
}

function VideoCallContent({ call }: { call: LiveCallRuntimeState['call'] }) {
  const { partner } = useCouple()
  const { endCall } = useCall()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const connectionState = useConnectionState()
  const cameraTracks = useTracks([Track.Source.Camera])
  const { activeAction, isBusy, run } = useSerializedMediaAction()
  const [cameraIssue, setCameraIssue] = useState<string | null>(null)
  const [microphoneIssue, setMicrophoneIssue] = useState<string | null>(null)
  const initialMediaStartedRef = useRef(false)
  const partnerName = partner?.display_name ?? 'your person'
  const remoteParticipant = remoteParticipants[0]
  const localCameraTrack = cameraTracks.find((track) => track.participant.identity === localParticipant.identity)
  const remoteCameraTrack = remoteParticipant ? cameraTracks.find((track) => track.participant.identity === remoteParticipant.identity) : undefined
  const reconnecting = connectionState === 'reconnecting' || connectionState === 'signalReconnecting'

  const enableMicrophone = useCallback(async () => {
    if (isMicrophoneEnabled) return
    try {
      const enabled = await run('microphone', () => localParticipant.setMicrophoneEnabled(true))
      if (enabled) setMicrophoneIssue(null)
    } catch (error) {
      setMicrophoneIssue(mediaMessage(error, 'microphone'))
    }
  }, [isMicrophoneEnabled, localParticipant, run])

  const enableCamera = useCallback(async () => {
    if (isCameraEnabled) return
    try {
      const enabled = await run('camera', () => localParticipant.setCameraEnabled(true, {
        facingMode: 'user',
        resolution: { width: 640, height: 480, frameRate: 20 },
      }))
      if (enabled) setCameraIssue(null)
    } catch (error) {
      setCameraIssue(mediaMessage(error, 'camera'))
    }
  }, [isCameraEnabled, localParticipant, run])

  useEffect(() => {
    if (connectionState !== 'connected' || initialMediaStartedRef.current) return
    initialMediaStartedRef.current = true
    void (async () => {
      // Safari and mobile Chrome are much more reliable when getUserMedia calls
      // are serialized instead of starting microphone and camera together.
      await enableMicrophone()
      await enableCamera()
    })()
  }, [connectionState, enableCamera, enableMicrophone])

  const toggleMic = useCallback(() => {
    if (isBusy || reconnecting) return
    void (async () => {
      try {
        const changed = await run('microphone', () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))
        if (changed) setMicrophoneIssue(null)
      } catch (error) {
        setMicrophoneIssue(mediaMessage(error, 'microphone'))
      }
    })()
  }, [isBusy, isMicrophoneEnabled, localParticipant, reconnecting, run])

  const toggleCamera = useCallback(() => {
    if (isBusy || reconnecting) return
    if (!isCameraEnabled) {
      void enableCamera()
      return
    }
    void (async () => {
      try {
        const changed = await run('camera', () => localParticipant.setCameraEnabled(false))
        if (changed) setCameraIssue(null)
      } catch (error) {
        setCameraIssue(mediaMessage(error, 'camera'))
      }
    })()
  }, [enableCamera, isBusy, isCameraEnabled, localParticipant, reconnecting, run])

  const note = reconnecting
    ? 'the internet is thinking.'
    : microphoneIssue
      ? microphoneIssue
      : remoteParticipant
        ? 'currently wasting bandwidth together.'
        : `waiting for ${partnerName} to connect...`

  return <main className="video-call-page page-shell">
    <StartMediaButton className="call-start-audio animated-button tone-yellow" label="TAP TO HEAR & SEE" />
    <header className="room-header">
      <button className="back-button" onClick={() => void endCall()} aria-label="End call and return home"><ArrowLeft size={18} /> <span>end call</span></button>
      <div className="room-name"><span className="room-live-dot" />video call in progress</div>
      <div className="room-status"><span className="eyebrow">{partnerName.toUpperCase()} + YOU</span></div>
    </header>
    <p className="room-presence-note">{note}</p>
    <section className="video-call-stage" aria-label="Video call">
      <div className="video-remote-frame">
        <span className="video-frame-label">{remoteParticipant ? partnerName : 'CONNECTING...'}</span>
        {remoteCameraTrack && remoteParticipant?.isCameraEnabled
          ? <VideoTrack trackRef={remoteCameraTrack} className="video-remote-media" />
          : <CameraPlaceholder name={partnerName} copy={remoteParticipant ? (remoteParticipant.isCameraEnabled ? 'their camera is waking up.' : 'probably doing something suspicious.') : 'their video will arrive when they do.'} />}
        {remoteParticipant && !remoteParticipant.isMicrophoneEnabled && <span className="video-muted-note">mic off</span>}
      </div>
      <aside className="video-local-frame" aria-label="Your camera preview">
        <span className="video-frame-label">YOU</span>
        {localCameraTrack && isCameraEnabled
          ? <VideoTrack trackRef={localCameraTrack} className="video-local-media" />
          : <CameraPlaceholder self name="You" copy={cameraIssue ?? 'you can keep talking without it.'} />}
        {cameraIssue && <button className="video-camera-retry" disabled={isBusy || reconnecting} onClick={() => void enableCamera()}>RETRY CAMERA</button>}
      </aside>
    </section>
    <CallDuration answeredAt={call.answered_at} />
    <CallControls micOn={isMicrophoneEnabled} micPending={activeAction === 'microphone'} cameraOn={isCameraEnabled} cameraPending={activeAction === 'camera'} mediaBusy={isBusy || reconnecting} filtersOn={false} reactionsOpen={false} mediaOpen={false} videoOnly onMic={toggleMic} onCamera={toggleCamera} onReactions={() => undefined} onFilters={() => undefined} onMedia={() => undefined} onHangup={() => void endCall()} />
  </main>
}

export function LiveVideoCallRoom({ session }: { session: LiveCallRuntimeState }) {
  const attempt = session.attempt

  return <CallRoomErrorBoundary key={`${session.call.id}:${attempt}`} fallback={<VideoCallProblem message="your browser tripped over the video room. try again." />}>
    <VideoCallContent call={session.call} />
  </CallRoomErrorBoundary>
}
