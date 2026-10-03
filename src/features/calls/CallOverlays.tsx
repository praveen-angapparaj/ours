import { AnimatePresence, motion } from 'motion/react'
import { PhoneCall, PhoneOff, Video } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCouple } from '../couple/use-couple'
import { isLiveCallState } from './types'
import { useCall } from './use-call'

export function CallOverlays() {
  const { state, notice, acceptCall, declineCall, cancelCall, dismissNotice } = useCall()
  const { partner } = useCouple()
  const navigate = useNavigate()
  const location = useLocation()
  const partnerName = partner?.display_name ?? 'your person'
  const incomingVideo = state.status === 'incoming-ringing' && state.call.call_type === 'video'
  const outgoingVideo = (state.status === 'outgoing-ringing' || state.status === 'accepting') && state.call.call_type === 'video'

  useEffect(() => {
    if (isLiveCallState(state) && location.pathname !== '/room') navigate('/room', { replace: true })
  }, [location.pathname, navigate, state])

  return <>
    <AnimatePresence>
      {state.status === 'incoming-ringing' && <motion.div className="call-overlay-backdrop" role="dialog" aria-modal="true" aria-label={`${partnerName} is calling`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section className="call-invitation call-incoming" initial={{ scale: .83, y: 36, rotate: -5 }} animate={{ scale: 1, y: 0, rotate: -.8 }} exit={{ scale: .9, y: 15 }} transition={{ type: 'spring', stiffness: 260, damping: 21 }}>
          <span className="call-invitation-phone is-ringing" aria-hidden="true"><PhoneCall /></span>
          <p className="eyebrow">{partnerName} is calling</p><h2>{incomingVideo ? 'They want your face in this.' : 'The little phone is ringing.'}</h2><p className="call-invitation-copy">{incomingVideo ? 'video call incoming.' : 'pick it up, or make them wonder.'}</p>
          <div className="call-invitation-actions"><button className="call-pick-up" onClick={() => void acceptCall()}><PhoneCall size={18} />PICK UP</button><button className="call-decline" onClick={() => void declineCall()}><PhoneOff size={18} />NOT NOW</button></div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
    <AnimatePresence>
      {(state.status === 'outgoing-ringing' || state.status === 'creating' || state.status === 'accepting') && <motion.div className="call-overlay-backdrop" role="dialog" aria-modal="true" aria-label="Call in progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section className="call-invitation call-outgoing" initial={{ scale: .84, y: 30, rotate: 4 }} animate={{ scale: 1, y: 0, rotate: .8 }} exit={{ scale: .9, y: 15 }} transition={{ type: 'spring', stiffness: 260, damping: 21 }}>
          <span className="call-invitation-phone is-dialing" aria-hidden="true">{outgoingVideo ? <Video /> : <PhoneCall />}</span>
          <p className="eyebrow">{state.status === 'creating' ? 'waking up the phone...' : state.status === 'accepting' ? 'they picked up.' : `calling ${partnerName}`}</p><h2>{outgoingVideo ? 'Both faces, apparently.' : 'Giving the receiver a ring.'}</h2><p className="call-invitation-copy">{state.status === 'creating' ? 'one tiny moment.' : outgoingVideo ? 'video call on its way.' : 'this could have been a text.'}</p>
          {state.status !== 'accepting' && <div className="call-invitation-actions"><button className="call-decline" onClick={() => void cancelCall()}><PhoneOff size={18} />PUT IT BACK</button></div>}
        </motion.section>
      </motion.div>}
    </AnimatePresence>
    <AnimatePresence>{notice && <motion.aside className="space-notice" role="alert" initial={{ opacity: 0, y: 16, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 1 }} exit={{ opacity: 0, y: 10 }}><span>{notice}</span><button type="button" onClick={dismissNotice}>okay</button></motion.aside>}</AnimatePresence>
  </>
}
