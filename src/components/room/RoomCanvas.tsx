import { Film, Music2, Orbit, Radio, Sparkles, Telescope, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { cardPress, springButton } from '../../lib/motion'

export type RoomCanvasMode = 'empty' | 'call' | 'video' | 'music'

type Option = {
  icon: LucideIcon
  title: string
  copy: string
  accent: 'yellow' | 'lavender' | 'mint'
  kind: 'watch' | 'music' | 'stupid'
}

const options: Option[] = [
  { icon: Film, title: 'Start a watch', copy: 'one shared screen, one small orbit', accent: 'yellow', kind: 'watch' },
  { icon: Music2, title: 'Set a soundtrack', copy: 'give the room a pulse', accent: 'lavender', kind: 'music' },
  { icon: Sparkles, title: 'Choose a detour', copy: 'follow a small curiosity together', accent: 'mint', kind: 'stupid' },
]

export function RoomCanvas({ mode, onMediaSelect }: { mode: RoomCanvasMode; onMediaSelect: (kind: Option['kind']) => void }) {
  return <div className={`media-surface canvas-${mode} observatory-canvas`}>
    <div className="media-topline observatory-topline">
      <span className="now-playing"><Radio size={15} aria-hidden="true" /> room signal open</span>
      <span className="connection"><i aria-hidden="true" /> quiet channel</span>
    </div>
    {mode === 'empty' && <div className="media-empty" aria-labelledby="observatory-title">
      <div className="empty-scribble media-empty-mark" aria-hidden="true"><Telescope size={48} /></div>
      <h1 id="observatory-title">The night is yours</h1>
      <p>Choose a little world to share,<br />or stay here beneath the same sky.</p>
      <div className="media-options">
        {options.map(({ icon: Icon, title, copy, accent, kind }) => <motion.button
          key={title}
          className={`media-option option-${accent} option-${kind}`}
          onClick={() => onMediaSelect(kind)}
          whileHover={{ y: -5, rotate: 0, scale: 1.07 }}
          whileTap={cardPress}
          transition={springButton}
        >
          <motion.span className="media-option-icon" whileHover={kind === 'watch' ? { rotate: [0, -8, 7, 0] } : kind === 'music' ? { y: [0, -4, 0] } : { rotate: [0, 18, 0] }} transition={{ duration: .34 }}><Icon aria-hidden="true" /></motion.span>
          <b>{title}</b>
          <small>{copy}</small>
        </motion.button>)}
      </div>
    </div>}
    <Orbit className="media-corner-doodle media-corner-mark" size={30} aria-hidden="true" />
  </div>
}
