import { AudioLines, MicOff, Orbit, Sparkles, Star, UserRound, WifiOff } from 'lucide-react'
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
  const className = `camera-card participant-card participant-${variant} ${isSelf ? 'you-camera participant-self' : 'her-camera participant-partner'} ${isSpeaking ? 'is-speaking' : ''} ${connectionState === 'poor' ? 'connection-poor' : ''}`
  const avatarMark = avatar === ':)' ? <UserRound aria-hidden="true" /> : avatar

  return <motion.article className={className} aria-label={`${name}'s observatory window`} layout transition={{ type: 'spring', stiffness: 280, damping: 24 }}>
    <Sticker className="participant-label" tone={isSelf ? 'yellow' : 'coral'}><Orbit size={11} aria-hidden="true" /> {label}</Sticker>
    <div className={`camera-art participant-card-art ${isSelf ? 'you-art' : 'her-art'} ${filtersEnabled ? 'filter-party celestial-filter' : ''} ${!cameraEnabled ? 'camera-disabled' : ''}`}>
      {cameraEnabled ? <>
        {isSelf ? <>
          <div className="you-lines" />
          <div className="you-face"><UserRound size={25} aria-hidden="true" /></div>
          {filtersEnabled && <span className="filter-stars" aria-label="Portrait filter active"><Sparkles size={18} /><Sparkles size={14} /></span>}
        </> : <>
          <Star className="camera-shine" size={25} aria-hidden="true" />
          <div className="big-avatar">{avatarMark}</div>
          <div className="camera-orbit orbit-one" />
          <div className="camera-orbit orbit-two" />
        </>}
      </> : <div className="shy-camera"><span className="shy-avatar">{avatarMark}</span><b>video resting</b></div>}
      {isSpeaking && <motion.span className="sound-marks" initial={{ opacity: 0, x: -3 }} animate={{ opacity: [0, 1, 1, 0], x: [0, 4, 7, 10] }} transition={{ repeat: Infinity, duration: 1.2 }}><AudioLines size={17} aria-label="Speaking" /></motion.span>}
    </div>
    <div className="camera-footer participant-card-footer">
      <span><i className="camera-live-dot" aria-hidden="true" /> {cameraEnabled ? 'Camera on' : 'Camera resting'}</span>
      <b>{connectionState === 'poor' ? <><WifiOff size={10} aria-hidden="true" /> signal searching</> : microphoneEnabled ? `${name}'s signal is live` : <><MicOff size={10} aria-hidden="true" /> quiet for now</>}</b>
    </div>
  </motion.article>
}
