import { CalendarDays, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { modalEnter } from '../../lib/motion'
import { ComicCard } from '../ComicCard'
import { Sticker } from '../Sticker'

function todayAsDateInput() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function calendarDayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function completeCalendarDays(startDate: string) {
  return Math.max(0, Math.round((calendarDayNumber(todayAsDateInput()) - calendarDayNumber(startDate)) / 86_400_000))
}

function formatLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}

export function TogetherCounter({ startDate, onSaveDate }: { startDate: string | null; onSaveDate: (date: string) => Promise<void> }) {
  const finalValue = startDate ? completeCalendarDays(startDate) : 0
  const [value, setValue] = useState(0)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(startDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reducedMotion = useReducedMotion()
  useEffect(() => { setDate(startDate ?? '') }, [startDate])
  useEffect(() => {
    if (!startDate) { setValue(0); return }
    if (reducedMotion) { setValue(finalValue); return }
    const started = performance.now(); let frame = 0
    const update = (now: number) => { const progress = Math.min((now - started) / 520, 1); setValue(Math.round(finalValue * (1 - (1 - progress) ** 3))); if (progress < 1) frame = requestAnimationFrame(update) }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [finalValue, startDate, reducedMotion])
  const save = async () => {
    setError(null)
    if (!date) { setError('pick the day this nonsense officially began.'); return }
    if (date > todayAsDateInput()) { setError('unless you are dating through time travel, pick a past date.'); return }
    setSaving(true)
    try { await onSaveDate(date); setOpen(false) } catch (saveError) { setError((saveError as Error).message) } finally { setSaving(false) }
  }
  if (!startDate) return <><ComicCard accent="mint" className="days-card no-date-card"><Sticker tone="yellow">NO RECEIPTS YET</Sticker><CalendarDays className="date-card-icon" /><h2>how long has this nonsense been going on?</h2><button className="set-date-button" onClick={() => setOpen(true)}>Set the date</button></ComicCard><DateModal open={open} date={date} saving={saving} error={error} onDate={setDate} onClose={() => setOpen(false)} onSave={() => void save()} /></>
  return <><ComicCard accent="mint" className="days-card"><Sticker tone="yellow">SINCE {startDate.slice(0, 4)}</Sticker><p className="day-number">{value}</p><h2>days of putting up<br />with each other</h2><p className="since-date">since {formatLocalDate(startDate)}</p><button className="counter-date-edit" onClick={() => setOpen(true)}>edit date</button><div className="tiny-hearts">♥ ♥</div></ComicCard><DateModal open={open} date={date} saving={saving} error={error} onDate={setDate} onClose={() => setOpen(false)} onSave={() => void save()} /></>
}

function DateModal({ open, date, saving, error, onDate, onClose, onSave }: { open: boolean; date: string; saving: boolean; error: string | null; onDate: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return <AnimatePresence>{open && <motion.div className="date-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="date-modal" role="dialog" aria-modal="true" aria-labelledby="relationship-date-title" initial={{ opacity: 0, scale: .85, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .9, y: 8 }} transition={modalEnter}><button className="date-modal-close" aria-label="Close relationship date dialog" onClick={onClose}><X size={17} /></button><p className="eyebrow">official nonsense records</p><h2 id="relationship-date-title">when did this start?</h2><label>Relationship started on<input type="date" value={date} max={todayAsDateInput()} onChange={(event) => onDate(event.target.value)} disabled={saving} /></label>{error && <p className="date-modal-error">{error}</p>}<button className="date-modal-save" onClick={onSave} disabled={saving}>{saving ? 'making it official...' : 'Make it official'}</button></motion.section></motion.div>}</AnimatePresence>
}
