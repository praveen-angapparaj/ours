import { type ReactNode } from 'react'
import { Radio, Tv } from 'lucide-react'
import type { PartnerPresenceStatus } from '../../features/presence/presence-types'
import { profileInitials } from '../../features/couple/profile-initials'

type SharedSpaceSceneProps = {
  partnerName: string
  partnerStatus: PartnerPresenceStatus
  callIsActive: boolean
  onCall: () => void
  onWatch: () => void
  onMusic: () => void
  onJoinRoom: () => void
  relationship: ReactNode
  annoy: ReactNode
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'your person'
}

function presenceLine(status: PartnerPresenceStatus, name: string) {
  const partner = firstName(name)
  if (status === 'online') return `${partner} is here.`
  if (status === 'in_room') return `${partner} saved a spot.`
  if (status === 'away') return `${partner} wandered off.`
  if (status === 'offline') return `${partner} is away.`
  return `looking for ${partner}...`
}

function ToyPerson({ label, initials, side, present }: { label: string; initials: string; side: 'you' | 'partner'; present: boolean }) {
  return <div className={`space-person space-person-${side}${present ? ' is-present' : ' is-away'}`} aria-hidden="true">
    <span className="toy-person-shadow" />
    <span className="toy-person-body"><i /></span>
    <span className="toy-person-head"><b>{initials}</b><i className="toy-person-face" /></span>
    <span className="toy-person-label">{label}</span>
  </div>
}

export function SharedSpaceScene({ partnerName, partnerStatus, callIsActive, onCall, onWatch, onMusic, onJoinRoom, relationship, annoy }: SharedSpaceSceneProps) {
  const partnerPresent = partnerStatus === 'online' || partnerStatus === 'in_room'
  const partnerInitials = profileInitials(partnerName, 'P')
  const partner = firstName(partnerName)

  return <section className={`shared-space-scene presence-${partnerStatus}${callIsActive ? ' has-active-call' : ''}`} aria-label="Our shared space">
    <div className="space-wallpaper" aria-hidden="true"><i /><i /><i /></div>
    <div className="space-title-stamp"><span>our space</span><small>est. two troublemakers</small></div>
    <div className="space-presence" role="status"><span className="space-presence-light" /><span><b>{presenceLine(partnerStatus, partnerName)}</b><small>{partnerStatus === 'in_room' ? 'in the room' : partnerStatus === 'online' ? 'desk lamp on' : 'their chair is keeping the place'}</small></span>{partnerStatus === 'in_room' && <button type="button" onClick={onJoinRoom}>join</button>}</div>
    <div className="space-lamp" aria-hidden="true"><i /><b /></div>
    <div className="space-rug" aria-hidden="true" />
    <div className="space-desk" aria-hidden="true"><i /><i /><i /></div>
    <ToyPerson label="you" initials=":)" side="you" present />
    <ToyPerson label={partner} initials={partnerInitials} side="partner" present={partnerPresent} />
    {!partnerPresent && <div className="space-empty-chair" aria-hidden="true"><i /><b /><span>{partner}’s spot</span></div>}

    <button className="space-object space-phone" type="button" onClick={onCall} aria-label={`Call ${partner}`}>
      <span className="object-tag">CALL {partner.toUpperCase()}</span><span className="phone-receiver" /><span className="phone-cord" /><small>{callIsActive ? 'off the hook' : 'this could be a text.'}</small>
    </button>
    <button className="space-object space-tv" type="button" onClick={onWatch} aria-label="Watch something together">
      <span className="object-tag">WATCH</span><span className="tv-shell"><Tv /><i /></span><span className="tv-legs" /><small>the tv is {partnerStatus === 'in_room' ? 'waiting.' : 'unemployed.'}</small>
    </button>
    <button className="space-object space-radio" type="button" onClick={onMusic} aria-label="Open the music room">
      <span className="object-tag">MUSIC</span><span className="radio-shell"><Radio /><i /><i /></span><small>tiny mixtape, someday.</small>
    </button>
    <div className="space-calendar">{relationship}</div>
    <div className="space-annoy"><span className="object-tag">DO NOT PRESS</span>{annoy}</div>
    <div className="space-note" aria-label="A note in your shared space"><span>today’s plan:</span><b>be near each other.</b><i>→</i></div>
    <div className="space-future-artifact" aria-hidden="true"><span>future<br />receipts</span><i>+</i></div>
  </section>
}
