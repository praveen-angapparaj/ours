import { Film, Music2, Sparkles, Volume2, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { cardPress, springButton } from '../../lib/motion'

export type RoomCanvasMode = 'empty' | 'call' | 'video' | 'music'
type Option = { icon: LucideIcon; title: string; copy: string; accent: 'yellow' | 'lavender' | 'mint'; kind: 'watch' | 'music' | 'stupid' }
const options: Option[] = [
  { icon: Film, title: 'Watch something', copy: 'pretend you picked it together', accent: 'yellow', kind: 'watch' },
  { icon: Music2, title: 'Play music', copy: 'one shared queue, infinite crimes', accent: 'lavender', kind: 'music' },
  { icon: Sparkles, title: 'Do something stupid', copy: 'the classics never fail', accent: 'mint', kind: 'stupid' },
]

export function RoomCanvas({ mode, onMediaSelect }: { mode: RoomCanvasMode; onMediaSelect: (kind: Option['kind']) => void }) {
  return <div className={`media-surface canvas-${mode}`}>
    <div className="media-topline"><span className="now-playing"><Volume2 size={15} /> just us being iconic</span><span className="connection"><i /> good vibes connection</span></div>
    {mode === 'empty' && <div className="media-empty"><div className="empty-scribble">???</div><h1>What are we doing?</h1><p>Nothing is playing. The possibilities are<br />vast and mostly unproductive.</p><div className="media-options">{options.map(({ icon: Icon, title, copy, accent, kind }) => <motion.button key={title} className={`media-option option-${accent} option-${kind}`} onClick={() => onMediaSelect(kind)} whileHover={{ y: -5, rotate: 0, scale: 1.07 }} whileTap={cardPress} transition={springButton}><motion.span className="media-option-icon" whileHover={kind === 'watch' ? { rotate: [0, -8, 7, 0] } : kind === 'music' ? { y: [0, -4, 0] } : { rotate: [0, 18, 0] }} transition={{ duration: .34 }}><Icon /></motion.span><b>{title}</b><small>{copy}</small></motion.button>)}</div></div>}
    <div className="media-corner-doodle">✦<br />✧</div>
  </div>
}
