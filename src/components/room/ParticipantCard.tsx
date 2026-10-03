import { MicOff, WifiOff } from 'lucide-react'
import { motion } from 'motion/react'
import { Sticker } from '../Sticker'

export type ParticipantCardProps = {
  name: string
  label: string
  avatar: string
  cameraEnabled: boolean
  microphoneEnabled: boolean
  isSpeaking: boolean
  connectionState: 'good' | 'poor'
  variant: 'coral' | 'blue'
  isSelf: boolean
  filtersEnabled?: boolean
}

export function ParticipantCard({ name, label, avatar, cameraEnabled, microphoneEnabled, isSpeaking, connectionState, variant, isSelf, filtersEnabled }: ParticipantCardProps) {
  const className = `camera-card ${isSelf ? 'you-camera' : 'her-camera'} ${isSpeaking ? 'is-speaking' : ''} ${connectionState === 'poor' ? 'connection-poor' : ''}`
  return <motion.article className={className} layout transition={{ type: 'spring', stiffness: 280, damping: 24 }}>
    <Sticker tone={isSelf ? 'yellow' : 'coral'}>{label}</Sticker>
    <div className={`camera-art ${isSelf ? 'you-art' : 'her-art'} ${filtersEnabled ? 'filter-party' : ''} ${!cameraEnabled ? 'camera-disabled' : ''}`}>
      {cameraEnabled ? <>{isSelf ? <><div className="you-lines" /><div className="you-face">:)</div>{filtersEnabled && <span className="filter-stars">✦ ✦</span>}</> : <><span className="camera-shine">✦</span><div className="big-avatar">{avatar}</div><div className="camera-orbit orbit-one" /><div className="camera-orbit orbit-two" /></>}</> : <div className="shy-camera"><span className="shy-avatar">{avatar}</span><b>camera is being shy</b></div>}
      {isSpeaking && <motion.span className="sound-marks" initial={{ opacity: 0, x: -3 }} animate={{ opacity: [0, 1, 1, 0], x: [0, 4, 7, 10] }} transition={{ repeat: Infinity, duration: 1.2 }}>)))</motion.span>}
    </div>
    <div className="camera-footer"><span><i className="camera-live-dot" /> {cameraEnabled ? 'Camera on' : 'Camera off'}</span><b>{connectionState === 'poor' ? <><WifiOff size={10} /> wifi having a personality crisis</> : microphoneEnabled ? `${name} is ${isSelf ? 'looking suspicious' : 'being cute, probably'}` : <><MicOff size={10} /> professionally silent</>}</b></div>
  </motion.article>
}
