import { Camera, Captions, Heart, Mic, PhoneOff, SlidersHorizontal } from 'lucide-react'
import { SquishyIconButton } from '../SquishyIconButton'

type CallControlsProps = { micOn: boolean; cameraOn: boolean; filtersOn: boolean; reactionsOpen: boolean; mediaOpen: boolean; audioOnly?: boolean; videoOnly?: boolean; mediaBusy?: boolean; mediaUnavailable?: boolean; micPending?: boolean; cameraPending?: boolean; onMic: () => void; onCamera: () => void; onReactions: () => void; onFilters: () => void; onMedia: () => void; onHangup: () => void }

export function CallControls({ micOn, cameraOn, filtersOn, reactionsOpen, mediaOpen, audioOnly = false, videoOnly = false, mediaBusy = false, mediaUnavailable = false, micPending = false, cameraPending = false, onMic, onCamera, onReactions, onFilters, onMedia, onHangup }: CallControlsProps) {
  return <nav className="call-dock" aria-label="Call controls">
    <SquishyIconButton label={mediaUnavailable ? 'Start a call to use the microphone' : micPending ? 'Updating microphone' : micOn ? 'Mute microphone' : 'Unmute microphone'} tooltip={mediaUnavailable ? 'start a call first' : micPending ? 'setting up microphone' : micOn ? 'mute signal' : 'open microphone'} active={micOn} disabled={mediaBusy || mediaUnavailable} onClick={onMic}><Mic size={20} /></SquishyIconButton>
    {videoOnly && <SquishyIconButton label={cameraPending ? 'Updating camera' : cameraOn ? 'Turn camera off' : 'Turn camera on'} tooltip={cameraPending ? 'setting up camera' : cameraOn ? 'close camera' : 'start camera'} active={cameraOn} disabled={mediaBusy} onClick={onCamera}><Camera size={20} /></SquishyIconButton>}
    {!audioOnly && !videoOnly && <><SquishyIconButton label={mediaUnavailable ? 'Start a call to use the camera' : cameraOn ? 'Turn camera off' : 'Turn camera on'} tooltip={mediaUnavailable ? 'start a call first' : cameraOn ? 'close camera' : 'start camera'} active={cameraOn} disabled={mediaBusy || mediaUnavailable} onClick={onCamera}><Camera size={20} /></SquishyIconButton><SquishyIconButton label="Open reactions" tooltip="send a signal" active={reactionsOpen} onClick={onReactions}><Heart size={20} /></SquishyIconButton><SquishyIconButton label="Toggle filters" tooltip="adjust portrait" active={filtersOn} onClick={onFilters}><SlidersHorizontal size={20} /></SquishyIconButton><SquishyIconButton label="Open shared screen" tooltip="choose something together" active={mediaOpen} onClick={onMedia}><Captions size={20} /></SquishyIconButton></>}
    <span className="dock-separator" />
    <SquishyIconButton label={audioOnly || videoOnly ? 'End call' : 'Leave room'} tooltip={audioOnly || videoOnly ? 'end connection' : 'leave observatory'} danger onClick={onHangup}><PhoneOff size={20} /></SquishyIconButton>
  </nav>
}
