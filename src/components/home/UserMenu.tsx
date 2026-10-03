import { Check, Copy, LogOut, Pencil, Save, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/use-auth'
import { asPronounSet, pronounOptions } from '../../features/auth/pronouns'
import { profileInitials } from '../../features/couple/profile-initials'
import { useCouple } from '../../features/couple/use-couple'
import { popover } from '../../lib/motion'

export function UserMenu() {
  const navigate = useNavigate()
  const { profile, updateProfile, signOut } = useAuth()
  const { couple, state: pairingState } = useCouple()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [pronounSet, setPronounSet] = useState(profile?.pronoun_set ?? 'they_them')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  useEffect(() => { setName(profile?.display_name ?? ''); setAvatarUrl(profile?.avatar_url ?? ''); setPronounSet(profile?.pronoun_set ?? 'they_them') }, [profile])
  const initial = profileInitials(profile?.display_name, 'Y')
  const copyPermanentCode = async () => {
    if (!couple) return
    try { await navigator.clipboard.writeText(couple.invite_code); setCodeCopied(true); window.setTimeout(() => setCodeCopied(false), 1600) } catch { setMessage('copying was blocked by your browser. Please select the code manually.') }
  }
  const save = async () => { setBusy(true); setMessage(null); try { await updateProfile(name, avatarUrl, pronounSet === 'she_her' || pronounSet === 'he_him' ? pronounSet : 'they_them'); setMessage('saved. new era.') } catch { setMessage('could not save your profile. Try again.') } finally { setBusy(false) } }
  const leaveSettings = () => { setOpen(false); navigate('/home') }
  const signOutOfDevice = async () => { setBusy(true); setMessage(null); try { await signOut(); navigate('/', { replace: true }) } catch { setMessage('could not sign out right now. Try again.') } finally { setBusy(false) } }
  return <div className="user-menu"><button className="user-menu-trigger" aria-label="Open profile settings" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{initial}</span><Pencil size={11} /></button><AnimatePresence>{open && <motion.div className="user-menu-popover" role="dialog" aria-label="Profile settings" {...popover}><div className="profile-popover-title"><UserRound size={15} /><b>your tiny ID card</b></div>{pairingState === 'paired' && couple && <div className="permanent-code"><span>your shared forever code</span><b>{couple.invite_code}</b><button type="button" onClick={() => void copyPermanentCode()}>{codeCopied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}</button></div>}<label>Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={48} /></label><label>Avatar URL <small>(optional)</small><input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} type="url" placeholder="https://..." /></label><label>Pronouns<select value={pronounSet} onChange={(event) => setPronounSet(asPronounSet(event.target.value))} disabled={busy}>{pronounOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{message && <p>{message}</p>}<button className="profile-save" onClick={save} disabled={busy}><Save size={13} /> {busy ? 'saving...' : 'save profile'}</button><button className="profile-close" onClick={leaveSettings} disabled={busy}><X size={13} /> close settings</button><button className="profile-logout" onClick={() => void signOutOfDevice()} disabled={busy}><LogOut size={13} /> sign out of this device</button></motion.div>}</AnimatePresence></div>
}
