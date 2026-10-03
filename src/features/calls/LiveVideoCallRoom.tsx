import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CameraOff } from 'lucide-react'
import { LiveKitRoom, RoomAudioRenderer, StartAudio, VideoTrack, useConnectionState, useLocalParticipant, useMediaDeviceSelect, useRemoteParticipants, useTracks } from '@livekit/components-react'
import { MediaDeviceFailure, Track } from 'livekit-client'
import { CallControls } from '../../components/room/CallControls'
import { useCouple } from '../couple/use-couple'
import { profileInitials } from '../couple/profile-initials'
import { useCall } from './use-call'
import { CallRoomErrorBoundary } from './CallRoomErrorBoundary'
import type { LiveCallRuntimeState } from './types'

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainingSeconds = seconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function useCallDuration(answeredAt: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  const answered = answeredAt ? Date.parse(answeredAt) : now
  return formatDuration(Math.max(0, Math.floor((now - answered) / 1_000)))
}

function cameraMessage(error: unknown) {
  const failure = typeof error === 'string'
    ? error as MediaDeviceFailure
    : error instanceof Error ? MediaDeviceFailure.getFailure(error) : undefined
  if (failure === MediaDeviceFailure.PermissionDenied) return 'camera said absolutely not.'
  if (failure === MediaDeviceFailure.NotFound) return 'no camera found. mysterious.'
  if (failure === MediaDeviceFailure.DeviceInUse) return 'your camera is busy elsewhere.'
  return 'we can hear you, but the camera is being difficult.'
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

function VideoCallContent({ call, initialCameraIssue }: { call: LiveCallRuntimeState['call'], initialCameraIssue: string | null }) {
  const { partner } = useCouple()
  const { endCall, reportCallProblem } = useCall()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const connectionState = useConnectionState()
  const cameraTracks = useTracks([Track.Source.Camera])
  const [cameraIssue, setCameraIssue] = useState<string | null>(initialCameraIssue)
  const [micPending, setMicPending] = useState(false)
  const [cameraPending, setCameraPending] = useState(false)
  const [flipPending, setFlipPending] = useState(false)
  const cameraAttempted = useRef(false)
  const partnerName = partner?.display_name ?? 'your person'
  const remoteParticipant = remoteParticipants[0]
  const localCameraTrack = cameraTracks.find((track) => track.participant.identity === localParticipant.identity)
  const remoteCameraTrack = remoteParticipant ? cameraTracks.find((track) => track.participant.identity === remoteParticipant.identity) : undefined
  const callDuration = useCallDuration(call.answered_at)
  const reconnecting = connectionState === 'reconnecting' || connectionState === 'signalReconnecting'
  const { devices: cameras, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: 'videoinput',
    requestPermissions: false,
    onError: (error) => setCameraIssue(cameraMessage(error)),
  })

  useEffect(() => { if (initialCameraIssue) setCameraIssue(initialCameraIssue) }, [initialCameraIssue])

  const enableCamera = useCallback(async () => {
    if (cameraPending) return
    setCameraPending(true)
    setCameraIssue(null)
    try {
      await localParticipant.setCameraEnabled(true, {
        facingMode: 'user',
        resolution: { width: 640, height: 480, frameRate: 20 },
      })
    } catch (error) {
      setCameraIssue(cameraMessage(error))
    } finally {
      setCameraPending(false)
    }
  }, [cameraPending, localParticipant])

  useEffect(() => {
    if (connectionState !== 'connected' || isCameraEnabled || cameraAttempted.current) return
    cameraAttempted.current = true
    void enableCamera()
  }, [connectionState, enableCamera, isCameraEnabled])

  // The room also disconnects on unmount, but explicitly unpublishing makes the
  // browser release camera and microphone hardware on every exit path.
  useEffect(() => () => {
    void localParticipant.setCameraEnabled(false).catch(() => undefined)
    void localParticipant.setMicrophoneEnabled(false).catch(() => undefined)
  }, [localParticipant])

  const toggleMic = () => {
    if (micPending) return
    setMicPending(true)
    void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
      .catch(reportCallProblem)
      .finally(() => setMicPending(false))
  }

  const toggleCamera = () => {
    if (cameraPending) return
    if (isCameraEnabled) {
      setCameraPending(true)
      void localParticipant.setCameraEnabled(false)
        .catch((error) => setCameraIssue(cameraMessage(error)))
        .finally(() => setCameraPending(false))
      return
    }
    cameraAttempted.current = true
    void enableCamera()
  }

  const flipCamera = () => {
    if (cameras.length < 2 || flipPending) return
    const currentIndex = cameras.findIndex((camera) => camera.deviceId === activeDeviceId)
    const nextCamera = cameras[(currentIndex + 1) % cameras.length]
    setFlipPending(true)
    void setActiveMediaDevice(nextCamera.deviceId)
      .catch((error) => setCameraIssue(cameraMessage(error)))
      .finally(() => setFlipPending(false))
  }

  const note = reconnecting
    ? 'the internet is thinking.'
    : remoteParticipant
      ? 'currently wasting bandwidth together.'
      : `waiting for ${partnerName} to connect...`

  return <main className="video-call-page page-shell">
    <RoomAudioRenderer />
    <StartAudio className="call-start-audio animated-button tone-yellow" label="TAP TO HEAR THEM" />
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
        {cameraIssue && <button className="video-camera-retry" onClick={() => { cameraAttempted.current = true; void enableCamera() }}>RETRY CAMERA</button>}
      </aside>
    </section>
    <div className="video-call-meta"><b aria-label={`Call duration ${callDuration}`}>{callDuration}</b><span>somehow still talking.</span></div>
    <CallControls micOn={isMicrophoneEnabled} micPending={micPending} cameraOn={isCameraEnabled} cameraPending={cameraPending} flipPending={flipPending} filtersOn={false} reactionsOpen={false} mediaOpen={false} videoOnly showFlipCamera={isCameraEnabled && cameras.length > 1} onMic={toggleMic} onCamera={toggleCamera} onFlipCamera={flipCamera} onReactions={() => undefined} onFilters={() => undefined} onMedia={() => undefined} onHangup={() => void endCall()} />
  </main>
}

export function LiveVideoCallRoom({ session }: { session: LiveCallRuntimeState }) {
  const { markRoomConnected } = useCall()
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [cameraIssue, setCameraIssue] = useState<string | null>(null)
  const attempt = session.status === 'connecting' ? session.attempt : 0

  useEffect(() => { setConnectionError(null); setCameraIssue(null) }, [attempt, session.call.id])

  if (!session.token || !session.serverUrl) return <VideoCallProblem message="the call could not connect." />
  if (connectionError) return <VideoCallProblem message={connectionError} />

  return <CallRoomErrorBoundary key={`${session.call.id}:${attempt}`} fallback={<VideoCallProblem message="your browser tripped over the video room. try again." />}><LiveKitRoom
    key={`${session.call.id}:${attempt}`}
    token={session.token}
    serverUrl={session.serverUrl}
    connect
    audio
    video={false}
    options={{ disconnectOnPageLeave: true, stopLocalTrackOnUnpublish: true, adaptiveStream: true, dynacast: true }}
    onConnected={() => markRoomConnected(session.call.id)}
    onError={(error) => setConnectionError(error.message || 'the call could not connect.')}
    onMediaDeviceFailure={(failure, kind) => {
      if (kind === 'videoinput') { setCameraIssue(cameraMessage(failure)); return }
      setConnectionError('your microphone said no. check its permission and try again.')
    }}
  >
    <VideoCallContent call={session.call} initialCameraIssue={cameraIssue} />
  </LiveKitRoom></CallRoomErrorBoundary>
}
