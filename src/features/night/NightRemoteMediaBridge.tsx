import { useEffect } from 'react'
import { useRemoteParticipants, useTracks } from '@livekit/components-react'
import { Track } from 'livekit-client'
import { useNightEnvironment } from './NightEnvironmentProvider'

export function NightRemoteMediaBridge() {
  const { setRemoteCameraActive } = useNightEnvironment()
  const remoteParticipant = useRemoteParticipants()[0]
  const cameraTracks = useTracks([Track.Source.Camera])
  const remoteCameraTrack = remoteParticipant ? cameraTracks.find((track) => track.participant.identity === remoteParticipant.identity) : undefined
  const remoteCameraActive = Boolean(remoteCameraTrack && remoteParticipant?.isCameraEnabled)

  useEffect(() => {
    setRemoteCameraActive(remoteCameraActive)
    return () => setRemoteCameraActive(false)
  }, [remoteCameraActive, setRemoteCameraActive])

  return null
}
