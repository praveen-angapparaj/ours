import { AnimatePresence, motion } from 'motion/react'
import { DoorOpen, Phone } from 'lucide-react'
import { useState } from 'react'
import { presenceCopy } from '../../features/presence/presence-copy'
import type { PartnerPresenceStatus } from '../../features/presence/presence-types'
import { profileInitials } from '../../features/couple/profile-initials'
import { popover } from '../../lib/motion'

const label: Record<PartnerPresenceStatus, string> = { online: 'ONLINE', away: 'AWAY', in_room: 'IN ROOM', offline: 'OFFLINE', unknown: 'UNKNOWN' }

export function PartnerPresence({ status = 'unknown', compact = false, name = 'M', onJoin, onCall }: { status?: PartnerPresenceStatus; compact?: boolean; name?: string; onJoin?: () => void; onCall?: () => void }) {
  const [open, setOpen] = useState(false)
  const initial = profileInitials(name)
  const statusCopy = presenceCopy(status, name)
  const detailsLabel = label[status]
  return <div className={`partner-presence presence-${status.replace('_', '-')}${compact ? ' is-compact' : ''}`}>
    <button className="partner-presence-button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="dialog" aria-label={`${name} is ${detailsLabel.toLowerCase()}. Open presence details.`}>
      <span className="mini-avatar">{initial}<span className="avatar-dot" /></span>
      <span className="presence-copy"><b>{detailsLabel}</b><span><i className="online-dot" />{statusCopy}</span></span>
    </button>
    <AnimatePresence>{open && <motion.div className="presence-popover" role="dialog" aria-label={`${name}'s presence details`} {...popover}>
      <div className="presence-popover-head"><span className="popover-avatar">{initial}</span><span><b>{name}</b><small>{statusCopy}</small></span></div>
      <div className="presence-actions">{status === 'in_room' && onJoin ? <button type="button" onClick={onJoin}><DoorOpen size={13} /> Join</button> : onCall ? <button type="button" onClick={onCall}><Phone size={13} /> Call</button> : null}</div>
    </motion.div>}</AnimatePresence>
  </div>
}
