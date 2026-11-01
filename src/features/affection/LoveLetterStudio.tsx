import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { EnvelopeIllustration, StarSigil } from './AffectionIllustrations'
import { friendlyAffectionError, newAffectionClientEventId } from './affection-service'
import type { AffectionEvent } from './affection-types'
import { useAffection } from './use-affection'

const MAX_LETTER_LENGTH = 280
type DeskMode = 'compose' | 'collection' | 'sealing' | 'reading'
type SealStage = 'fold' | 'sealed' | 'depart'
type ReadingStage = 'approach' | 'unseal' | 'open' | 'reveal' | 'closing'

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'your person'
}

function ReadingLetter({ letter, stage, onClose }: { letter: AffectionEvent; stage: ReadingStage; onClose: () => void }) {
  const envelopePhase = stage === 'approach' ? 'approach' : stage === 'unseal' ? 'unseal' : 'open'
  const messageVisible = stage === 'reveal'
  return <section className={`letter-reading-stage is-${stage}`} aria-label="A letter from your person">
    <motion.div className="reading-envelope" initial={{ opacity: 0, y: 34, scale: .72 }} animate={{ opacity: stage === 'closing' ? 0 : 1, y: stage === 'approach' ? -34 : -66, scale: stage === 'approach' ? 1.06 : .9 }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}><EnvelopeIllustration phase={envelopePhase} /></motion.div>
    <motion.article className="reading-paper" initial={{ opacity: 0, y: 48, scale: .96, rotateX: -72 }} animate={{ opacity: messageVisible ? 1 : 0, y: messageVisible ? 0 : 48, scale: messageVisible ? 1 : .96, rotateX: messageVisible ? 0 : -72 }} transition={{ duration: .48, ease: [0.22, .84, .28, 1] }} style={{ transformPerspective: 1200, transformStyle: 'preserve-3d', transformOrigin: '50% 100%' }}>
      <span className="letter-paper-star"><StarSigil size={15} /></span><small>FROM YOUR PERSON</small><p>{letter.message}</p><button type="button" onClick={onClose}>Fold this close</button>
    </motion.article>
    <p className="letter-reading-status" role="status">{stage === 'approach' ? 'A letter is finding its way to you...' : stage === 'unseal' ? 'The seal is softening...' : stage === 'open' ? 'Unfolding something small...' : stage === 'reveal' ? 'A little something, just for you.' : ''}</p>
  </section>
}

export function LoveLetterStudio({ partnerName }: { partnerName: string }) {
  const { loveDrops, loveDropsLoading, openDrop, sendLoveDrop, setLetterDeskOpen, unreadLoveDropCount } = useAffection()
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<DeskMode>('compose')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sealStage, setSealStage] = useState<SealStage>('fold')
  const [selected, setSelected] = useState<AffectionEvent | null>(null)
  const [readingStage, setReadingStage] = useState<ReadingStage>('approach')
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const eventId = useRef<string | null>(null)
  const timers = useRef<number[]>([])
  const pageVisible = useRef(document.visibilityState === 'visible')
  const [visible, setVisible] = useState(pageVisible.current)
  const name = firstName(partnerName)

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }
  const later = (callback: () => void, delay: number) => { timers.current.push(window.setTimeout(callback, reducedMotion ? 0 : delay)) }

  useEffect(() => () => clearTimers(), [])
  useEffect(() => {
    setLetterDeskOpen(open)
    return () => setLetterDeskOpen(false)
  }, [open, setLetterDeskOpen])
  useEffect(() => {
    const sync = () => { pageVisible.current = document.visibilityState === 'visible'; setVisible(pageVisible.current) }
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || mode === 'sealing') return
      setLetterDeskOpen(false)
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mode, open])
  useEffect(() => {
    if (mode !== 'reading') return
    clearTimers()
    setReadingStage('approach')
    later(() => setReadingStage('unseal'), 360)
    later(() => setReadingStage('open'), 760)
    later(() => setReadingStage('reveal'), 1_180)
    return () => clearTimers()
  }, [mode, selected?.id])

  const openDesk = () => {
    clearTimers()
    setNotice(null)
    setMode(unreadLoveDropCount ? 'collection' : 'compose')
    setLetterDeskOpen(true)
    setOpen(true)
  }
  const closeDesk = () => {
    if (mode === 'sealing') return
    clearTimers()
    setLetterDeskOpen(false)
    setOpen(false)
    setSelected(null)
  }
  const send = async () => {
    const message = draft.trim()
    if (!message) { setNotice('Leave a few words on the paper first.'); return }
    if (sending) return
    const id = eventId.current ?? newAffectionClientEventId()
    eventId.current = id
    setSending(true)
    setNotice('Holding the paper while it is safely saved...')
    try {
      await sendLoveDrop(message, id)
      eventId.current = null
      setMode('sealing')
      setSealStage('fold')
      setNotice('The letter is folding itself into the night.')
      clearTimers()
      later(() => setSealStage('sealed'), 700)
      later(() => setSealStage('depart'), 1_300)
      later(() => { setDraft(''); setNotice(null); setMode('compose'); setLetterDeskOpen(false); setOpen(false) }, 2_500)
    } catch (error) {
      setNotice(friendlyAffectionError(error))
    } finally {
      setSending(false)
    }
  }
  const openLetter = async (letter: AffectionEvent) => {
    if (openingId) return
    if (letter.opened_at) { setSelected(letter); setMode('reading'); return }
    setOpeningId(letter.id)
    setNotice(null)
    try {
      const opened = await openDrop(letter.id)
      setSelected(opened)
      setMode('reading')
    } catch (error) {
      setNotice(friendlyAffectionError(error))
    } finally {
      setOpeningId(null)
    }
  }
  const closeReading = () => {
    clearTimers()
    setReadingStage('closing')
    later(() => { setSelected(null); setMode('collection') }, 430)
  }

  return <div className={`dock-gesture dock-living-letters${unreadLoveDropCount ? ' has-letters' : ''}`}>
    <button type="button" className={`dock-letter-control${visible ? '' : ' is-still'}`} onClick={openDesk} aria-expanded={open} aria-controls="living-love-letters">
      <span className="dock-letter-envelope"><EnvelopeIllustration /></span><span><b>Living letters</b><small>{unreadLoveDropCount ? `${unreadLoveDropCount} waiting for you` : 'leave something for later'}</small></span>{unreadLoveDropCount > 0 && <i aria-label={`${unreadLoveDropCount} unopened letters`}>{unreadLoveDropCount > 9 ? '9+' : unreadLoveDropCount}</i>}
    </button>
    <AnimatePresence>{open && <motion.div className="letter-desk-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><button className="letter-desk-dim" type="button" onClick={closeDesk} aria-label="Close letter desk" /><motion.section id="living-love-letters" className={`letter-desk is-${mode}${sealStage === 'depart' ? ' is-departing' : ''}`} role="dialog" aria-modal="true" aria-label="Living Love Letters" initial={{ opacity: 0, y: 28, rotateX: -6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: 18, rotateX: -4 }} transition={{ type: 'spring', stiffness: 180, damping: 24 }}>
      <header className="letter-desk-header"><button type="button" className={mode === 'compose' ? 'is-current' : ''} onClick={() => setMode('compose')} disabled={mode === 'sealing'}>Write</button><span>living love letters</span><button type="button" className={mode === 'collection' ? 'is-current' : ''} onClick={() => setMode('collection')} disabled={mode === 'sealing'}>For you{unreadLoveDropCount ? ` (${unreadLoveDropCount})` : ''}</button><button className="letter-desk-close" type="button" onClick={closeDesk} disabled={mode === 'sealing'}>Close</button></header>
      {mode === 'compose' && <section className="letter-composer"><motion.article className="letter-paper" layout><span className="letter-paper-star"><StarSigil size={17} /></span><p className="letter-paper-address">FOR {name.toUpperCase()}</p><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_LETTER_LENGTH} rows={6} placeholder="A small truth, a private joke, something to find later..." disabled={sending} aria-label={`A letter for ${name}`} /><footer><small>{draft.length}/{MAX_LETTER_LENGTH}</small><button type="button" onClick={() => void send()} disabled={sending || !draft.trim()}>{sending ? 'Saving safely...' : 'Fold and send'}</button></footer></motion.article><div className="letter-composer-envelope"><EnvelopeIllustration phase="rest" /><p>Your words stay yours until they reach {name}.</p></div></section>}
      {mode === 'sealing' && <section className="letter-sending-scene" aria-live="polite"><motion.article className="letter-paper letter-paper-sending" initial={{ y: 0, scale: 1, rotateX: 0, opacity: 1 }} animate={sealStage === 'depart' ? { y: -220, scale: .3, rotateX: -10, opacity: 0 } : sealStage === 'sealed' ? { y: 18, scale: .86, rotateX: 5, opacity: .12 } : { y: 0, scale: 1, rotateX: 0, opacity: 1 }} transition={{ duration: sealStage === 'depart' ? .84 : .68, ease: [0.22, .84, .28, 1] }} style={{ transformPerspective: 1200, transformStyle: 'preserve-3d', transformOrigin: '50% 50%' }}><motion.i className="letter-fold-panel letter-fold-top" aria-hidden="true" initial={{ opacity: 0, rotateX: -82 }} animate={{ opacity: sealStage === 'depart' ? 0 : sealStage === 'sealed' ? .96 : [0, .86, .96], rotateX: sealStage === 'depart' ? 0 : sealStage === 'sealed' ? 0 : [-82, -28, 0] }} transition={{ duration: .54, times: [0, .58, 1], ease: [0.22, .82, .25, 1] }} /><motion.i className="letter-fold-panel letter-fold-bottom" aria-hidden="true" initial={{ opacity: 0, rotateX: 82 }} animate={{ opacity: sealStage === 'depart' ? 0 : sealStage === 'sealed' ? .9 : [0, .76, .9], rotateX: sealStage === 'depart' ? 0 : sealStage === 'sealed' ? 0 : [82, 24, 0] }} transition={{ duration: .54, delay: .08, times: [0, .58, 1], ease: [0.22, .82, .25, 1] }} /><span className="letter-paper-star"><StarSigil size={17} /></span><motion.p animate={sealStage === 'fold' ? { opacity: [1, 1, 0], y: [0, 0, 7] } : { opacity: 0, y: 7 }} transition={{ duration: .5, times: [0, .54, 1], ease: [0.22, .82, .25, 1] }}>{draft}</motion.p></motion.article><motion.div className="sending-envelope" initial={{ y: 32, scale: .88, opacity: 0 }} animate={sealStage === 'fold' ? { y: 32, scale: .88, opacity: 0 } : sealStage === 'sealed' ? { y: 0, scale: 1, opacity: 1 } : { y: -220, scale: .28, opacity: 0 }} transition={{ duration: sealStage === 'depart' ? 1.08 : .46, ease: [0.22, .84, .28, 1] }}><EnvelopeIllustration phase={sealStage === 'depart' ? 'depart' : 'rest'} /></motion.div><p>{sealStage === 'depart' ? 'A sealed letter is becoming a speck of light.' : sealStage === 'sealed' ? 'A wax seal is keeping your words safe.' : 'The paper is folding itself into the night.'}</p></section>}
      {mode === 'collection' && <section className="letter-collection"><p className="letter-collection-intro">Things {name} left where only you would find them.</p>{loveDropsLoading && <p className="letter-empty">Listening for folded paper...</p>}{!loveDropsLoading && !loveDrops.length && <p className="letter-empty">No letters are resting here yet.</p>}<div className="letter-stack">{loveDrops.map((letter) => <button type="button" className={`letter-inbox-item${letter.opened_at ? ' is-opened' : ''}`} key={letter.id} onClick={() => void openLetter(letter)} disabled={openingId === letter.id}><EnvelopeIllustration phase="rest" /><span><b>{openingId === letter.id ? 'Unsealing...' : letter.opened_at ? 'Read again' : 'A sealed letter'}</b><small>{letter.opened_at ? 'kept close in your collection' : 'open when it feels right'}</small></span></button>)}</div></section>}
      {mode === 'reading' && selected && <ReadingLetter letter={selected} stage={readingStage} onClose={closeReading} />}
      {notice && <p className="letter-desk-notice" role="status">{notice}</p>}
    </motion.section></motion.div>}</AnimatePresence>
  </div>
}
