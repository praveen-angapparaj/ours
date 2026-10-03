import { Camera, Captions, Heart, Mic, PhoneOff, SlidersHorizontal } from 'lucide-react'
import { SquishyIconButton } from '../SquishyIconButton'

type CallControlsProps = { micOn: boolean; cameraOn: boolean; filtersOn: boolean; reactionsOpen: boolean; mediaOpen: boolean; audioOnly?: boolean; videoOnly?: boolean; mediaBusy?: boolean; micPending?: boolean; cameraPending?: boolean; onMic: () => void; onCamera: () => void; onReactions: () => void; onFilters: () => void; onMedia: () => void; onHangup: () => void }

export function CallControls({ micOn, cameraOn, filtersOn, reactionsOpen, mediaOpen, audioOnly = false, videoOnly = false, mediaBusy = false, micPending = false, cameraPending = false, onMic, onCamera, onReactions, onFilters, onMedia, onHangup }: CallControlsProps) {
  return <nav className="call-dock" aria-label="Call controls">
    <SquishyIconButton label={micPending ? 'Updating microphone' : micOn ? 'Mute microphone' : 'Unmute microphone'} tooltip={micPending ? 'setting up microphone' : micOn ? 'mute my nonsense' : 'resume nonsense'} active={micOn} disabled={mediaBusy} onClick={onMic}><Mic size={20} /></SquishyIconButton>
    {videoOnly && <SquishyIconButton label={cameraPending ? 'Updating camera' : cameraOn ? 'Turn camera off' : 'Turn camera on'} tooltip={cameraPending ? 'setting up camera' : cameraOn ? 'hide this face' : 'unfortunately return'} active={cameraOn} disabled={mediaBusy} onClick={onCamera}><Camera size={20} /></SquishyIconButton>}
    {!audioOnly && !videoOnly && <><SquishyIconButton label={cameraOn ? 'Turn camera off' : 'Turn camera on'} tooltip={cameraOn ? 'hide this face' : 'unfortunately return'} active={cameraOn} onClick={onCamera}><Camera size={20} /></SquishyIconButton><SquishyIconButton label="Open reactions" tooltip="cause a scene" active={reactionsOpen} onClick={onReactions}><Heart size={20} /></SquishyIconButton><SquishyIconButton label="Toggle filters" tooltip="questionable technology" active={filtersOn} onClick={onFilters}><SlidersHorizontal size={20} /></SquishyIconButton><SquishyIconButton label="Toggle media chooser" tooltip="put something on" active={mediaOpen} onClick={onMedia}><Captions size={20} /></SquishyIconButton></>}
    <span className="dock-separator" />
    <SquishyIconButton label={audioOnly || videoOnly ? 'End call' : 'Leave room'} tooltip={audioOnly || videoOnly ? 'hang up' : 'abandon ship'} danger onClick={onHangup}><PhoneOff size={20} /></SquishyIconButton>
  </nav>
}
