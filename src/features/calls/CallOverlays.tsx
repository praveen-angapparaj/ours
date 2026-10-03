import { AnimatePresence, motion } from 'motion/react';
import { useCall } from './use-call';
import { useCouple } from '../couple/use-couple';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { isLiveCallState } from './types';

export function CallOverlays() {
  const { state, notice, acceptCall, declineCall, cancelCall, dismissNotice } = useCall();
  const { partner } = useCouple();
  const navigate = useNavigate();
  const location = useLocation();

  const partnerName = partner?.display_name ?? 'your person';
  const incomingVideo = state.status === 'incoming-ringing' && state.call.call_type === 'video';
  const outgoingVideo = (state.status === 'outgoing-ringing' || state.status === 'accepting') && state.call.call_type === 'video';

  useEffect(() => {
    if (isLiveCallState(state) && location.pathname !== '/room' && location.pathname !== '/watch') {
      navigate('/room', { replace: true });
    }
  }, [location.pathname, navigate, state]);

  return (
    <>
      <AnimatePresence>
        {state.status === 'incoming-ringing' && (
          <motion.div 
            className="date-modal-backdrop"
            style={{ zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="date-modal"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{ textAlign: 'center' }}
            >
              <div className="eyebrow" style={{ color: 'var(--coral)', marginBottom: 20 }}>{partnerName} IS {incomingVideo ? 'VIDEO ' : ''}CALLING</div>
              <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>{incomingVideo ? <>apparently seeing your face<br />was suddenly urgent.</> : "apparently this couldn't wait."}</h2>
              <div style={{ display: 'grid', gap: '10px', marginTop: '30px' }}>
                <button className="animated-button tone-yellow" onClick={() => void acceptCall()}>
                  ACCEPT
                </button>
                <button className="animated-button tone-coral" onClick={() => void declineCall()}>
                  DECLINE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(state.status === 'outgoing-ringing' || state.status === 'creating' || state.status === 'accepting') && (
          <motion.div 
            className="date-modal-backdrop"
            style={{ zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="date-modal"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{ textAlign: 'center' }}
            >
              <div className="eyebrow" style={{ color: 'var(--blue)', marginBottom: 20 }}>
                {state.status === 'creating' ? 'starting a call...' : state.status === 'accepting' ? `answering ${outgoingVideo ? 'a video call' : '...'} ` : `ringing ${partnerName}${outgoingVideo ? ' for video' : ''}...`}
              </div>
              <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>{outgoingVideo ? <>apparently this needed<br />both your faces.</> : <>probably about to say something<br/>that could&apos;ve been a text.</>}</h2>
              <div style={{ display: 'grid', gap: '10px', marginTop: '30px' }}>
                {state.status !== 'accepting' && <button className="animated-button tone-paper" onClick={() => void cancelCall()}>
                  CANCEL
                </button>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.aside 
            className="presence-toast" 
            role="alert" 
            initial={{ opacity: 0, y: 16, rotate: -2 }} 
            animate={{ opacity: 1, y: 0, rotate: 1 }} 
            exit={{ opacity: 0, y: 10 }}
            style={{ background: 'var(--coral)', zIndex: 999 }}
          >
            <span>{notice}</span>
            <button type="button" onClick={dismissNotice}>okay</button>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
