import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useConnectionState, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react'
import { CallControls } from '../../components/room/CallControls'
import { ParticipantCard } from '../../components/room/ParticipantCard'
import { RoomCanvas } from '../../components/room/RoomCanvas'
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

async function waitForMediaAction(operation: () => Promise<unknown>) {
  let timeout: number | undefined
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) => { timeout = window.setTimeout(() => reject(new Error('media_action_timeout')), 8_000) }),
    ])
  } finally {
    window.clearTimeout(timeout)
  }
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
  const { endCall, reportCallProblem } = useCall()
  const { localParticipant } = useLocalParticipant()
  const remoteParticipants = useRemoteParticipants()
  const connectionState = useConnectionState()
  const partnerName = partner?.display_name ?? 'your person'
  const partnerInitial = profileInitials(partnerName, 'M')
  const remoteParticipant = remoteParticipants[0]
  const callDuration = useCallDuration(call.answered_at)
  const micOn = localParticipant?.isMicrophoneEnabled ?? false
  const [micPending, setMicPending] = useState(false)
  const reconnecting = connectionState === 'reconnecting' || connectionState === 'signalReconnecting'

  const handleMicToggle = () => {
    if (!localParticipant || micPending) return
    setMicPending(true)
    void waitForMediaAction(() => localParticipant.setMicrophoneEnabled(!micOn))
      .catch(reportCallProblem)
      .finally(() => setMicPending(false))
  }

  const note = reconnecting
    ? 'the internet is thinking.'
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
    <div className="audio-call-timer" aria-label={`Call duration ${callDuration}`}><b>{callDuration}</b><span>audio only • no surprise cameras</span></div>
    <section className="room-stage">
      <RoomCanvas mode="call" onMediaSelect={() => undefined} />
      <ParticipantCard name={partnerName} label={remoteParticipant ? 'PARTNER IN CALL' : 'CONNECTING...'} avatar={partnerInitial} cameraEnabled={false} microphoneEnabled={remoteParticipant?.isMicrophoneEnabled ?? false} isSpeaking={remoteParticipant?.isSpeaking ?? false} connectionState={remoteParticipant ? 'good' : 'poor'} variant="coral" isSelf={false} />
      <ParticipantCard name="You" label="YOU, UNFORTUNATELY" avatar=":)" cameraEnabled={false} microphoneEnabled={micOn} isSpeaking={localParticipant?.isSpeaking ?? false} connectionState="good" variant="blue" isSelf />
    </section>
    <CallControls micOn={micOn} micPending={micPending} cameraOn={false} filtersOn={false} reactionsOpen={false} mediaOpen={false} audioOnly onMic={handleMicToggle} onCamera={() => undefined} onReactions={() => undefined} onFilters={() => undefined} onMedia={() => undefined} onHangup={() => void endCall()} />
  </main>
}

export function LiveAudioCallRoom({ session }: { session: LiveCallRuntimeState }) {
  const { markRoomConnected } = useCall()
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const attempt = session.status === 'connecting' ? session.attempt : 0

  useEffect(() => setConnectionError(null), [attempt, session.call.id])

  if (!session.token || !session.serverUrl) return <CallProblem message="the call could not connect." />
  if (connectionError) return <CallProblem message={connectionError} />

  return <CallRoomErrorBoundary key={`${session.call.id}:${attempt}`} fallback={<CallProblem message="your browser tripped over the call room. try again." />}><LiveKitRoom
    key={`${session.call.id}:${attempt}`}
    token={session.token}
    serverUrl={session.serverUrl}
    connect
    audio
    video={false}
    options={{ disconnectOnPageLeave: true, stopLocalTrackOnUnpublish: true, adaptiveStream: true, dynacast: true }}
    onConnected={() => markRoomConnected(session.call.id)}
    onError={(error) => setConnectionError(error.message || 'the call could not connect.')}
    onMediaDeviceFailure={() => setConnectionError('your microphone said no.')}
  >
    <AudioCallContent call={session.call} />
  </LiveKitRoom></CallRoomErrorBoundary>
}
