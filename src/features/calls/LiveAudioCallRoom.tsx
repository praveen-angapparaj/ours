import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useConnectionState, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react'
import { MediaDeviceFailure } from 'livekit-client'
import { CallControls } from '../../components/room/CallControls'
import { ParticipantCard } from '../../components/room/ParticipantCard'
import { RoomCanvas } from '../../components/room/RoomCanvas'
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
  return <div className="audio-call-timer" aria-label={`Call duration ${duration}`}><b>{duration}</b><span>audio only • no surprise cameras</span></div>
}

function microphoneMessage(error: unknown) {
  const failure = typeof error === 'string'
    ? error as MediaDeviceFailure
    : error instanceof Error ? MediaDeviceFailure.getFailure(error) : undefined
  if (failure === MediaDeviceFailure.PermissionDenied) return 'microphone permission is off. turn it on in your browser settings.'
  if (failure === MediaDeviceFailure.NotFound) return 'no microphone was found.'
  if (failure === MediaDeviceFailure.DeviceInUse) return 'your microphone is busy in another app.'
  return 'the microphone could not start. try its button once more.'
}

function CallProblem({ message }: { message: string }) {
  const { endCall, retryConnection } = useCall()
  return <main className="call-connecting page-shell">
    <section className="call-connecting-card">
      <p className="eyebrow">audio call hiccup</p>
      <h1>{message}</h1>
      <p>check your microphone permission, then give it another go.</p>
      <div className="call-problem-actions"><button className="animated-button tone-yellow" onClick={retryConnection}>TRY AGAIN</button><button className="animated-button tone-coral" onClick={() => void endCall()}>END CALL</button></div>
    </section>
  </main>
}

function AudioCallContent({ call }: { call: LiveCallRuntimeState['call'] }) {
  const { partner } = useCouple()
  const { endCall } = useCall()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const connectionState = useConnectionState()
  const { activeAction, isBusy, run } = useSerializedMediaAction()
  const [microphoneIssue, setMicrophoneIssue] = useState<string | null>(null)
  const microphoneStartedRef = useRef(false)
  const partnerName = partner?.display_name ?? 'your person'
  const partnerInitial = profileInitials(partnerName, 'M')
  const remoteParticipant = remoteParticipants[0]
  const reconnecting = connectionState === 'reconnecting' || connectionState === 'signalReconnecting'

  const enableMicrophone = useCallback(async () => {
    if (isMicrophoneEnabled) return
    try {
      const started = await run('microphone', () => localParticipant.setMicrophoneEnabled(true))
      if (started) setMicrophoneIssue(null)
    } catch (error) {
      setMicrophoneIssue(microphoneMessage(error))
    }
  }, [isMicrophoneEnabled, localParticipant, run])

  useEffect(() => {
    if (connectionState !== 'connected' || microphoneStartedRef.current) return
    microphoneStartedRef.current = true
    void enableMicrophone()
  }, [connectionState, enableMicrophone])

  const handleMicToggle = useCallback(() => {
    if (isBusy || reconnecting) return
    void (async () => {
      try {
        const changed = await run('microphone', () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))
        if (changed) setMicrophoneIssue(null)
      } catch (error) {
        setMicrophoneIssue(microphoneMessage(error))
      }
    })()
  }, [isBusy, isMicrophoneEnabled, localParticipant, reconnecting, run])

  const note = reconnecting
    ? 'the internet is thinking.'
    : microphoneIssue
      ? microphoneIssue
      : remoteParticipant
        ? 'you two are talking. probably about something historically important.'
        : `waiting for ${partnerName} to connect...`

  return <main className="room-page page-shell">
    <RoomAudioRenderer />
    <StartAudio className="call-start-audio animated-button tone-yellow" label="TAP TO HEAR THEM" />
    <header className="room-header">
      <button className="back-button" onClick={() => void endCall()} aria-label="End call and return home"><ArrowLeft size={18} /> <span>end call</span></button>
      <div className="room-name"><span className="room-live-dot" />audio call in progress</div>
      <div className="room-status"><span className="eyebrow">{partnerName.toUpperCase()} + YOU</span></div>
    </header>
    <p className="room-presence-note">{note}</p>
    <CallDuration answeredAt={call.answered_at} />
    <section className="room-stage">
      <RoomCanvas mode="call" onMediaSelect={() => undefined} />
      <ParticipantCard name={partnerName} label={remoteParticipant ? 'PARTNER IN CALL' : 'CONNECTING...'} avatar={partnerInitial} cameraEnabled={false} microphoneEnabled={remoteParticipant?.isMicrophoneEnabled ?? false} isSpeaking={remoteParticipant?.isSpeaking ?? false} connectionState={remoteParticipant ? 'good' : 'poor'} variant="coral" isSelf={false} />
      <ParticipantCard name="You" label="YOU, UNFORTUNATELY" avatar=":)" cameraEnabled={false} microphoneEnabled={isMicrophoneEnabled} isSpeaking={localParticipant.isSpeaking} connectionState="good" variant="blue" isSelf />
    </section>
    <CallControls micOn={isMicrophoneEnabled} micPending={activeAction === 'microphone'} mediaBusy={isBusy} cameraOn={false} filtersOn={false} reactionsOpen={false} mediaOpen={false} audioOnly onMic={handleMicToggle} onCamera={() => undefined} onReactions={() => undefined} onFilters={() => undefined} onMedia={() => undefined} onHangup={() => void endCall()} />
  </main>
}

export function LiveAudioCallRoom({ session }: { session: LiveCallRuntimeState }) {
  const { markRoomConnected, reportRoomConnectionError, reportRoomDisconnected } = useCall()
  const attempt = session.attempt

  if (!session.token || !session.serverUrl) return <CallProblem message="the call could not connect." />

  return <CallRoomErrorBoundary key={`${session.call.id}:${attempt}`} fallback={<CallProblem message="your browser tripped over the call room. try again." />}><LiveKitRoom
    key={`${session.call.id}:${attempt}`}
    token={session.token}
    serverUrl={session.serverUrl}
    connect
    audio={false}
    video={false}
    options={{ disconnectOnPageLeave: true, stopLocalTrackOnUnpublish: true, adaptiveStream: true, dynacast: true }}
    onConnected={() => markRoomConnected(session.call.id, attempt)}
    onError={(error) => reportRoomConnectionError(session.call.id, attempt, error)}
    onDisconnected={(reason) => reportRoomDisconnected(session.call.id, attempt, reason)}
  >
    <AudioCallContent call={session.call} />
  </LiveKitRoom></CallRoomErrorBoundary>
}
