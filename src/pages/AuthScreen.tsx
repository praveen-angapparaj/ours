import { Eye, EyeOff, KeyRound, Mail, UserRound } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatedButton } from '../components/AnimatedButton'
import { ComicCard } from '../components/ComicCard'
import { useAuth } from '../features/auth/use-auth'
import { friendlyAuthError } from '../features/auth/auth-service'
import { asPronounSet, pronounOptions } from '../features/auth/pronouns'
import { modalEnter } from '../lib/motion'

export function AuthScreen({ mode }: { mode: 'signin' | 'signup' }) {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pronounSet, setPronounSet] = useState('they_them')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationNeeded, setConfirmationNeeded] = useState(false)
  const signup = mode === 'signup'
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null)
    if (signup && name.trim().length < 2) { setError('tell us what to call you - two characters minimum.'); return }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('that email needs an @ and a real-looking ending.'); return }
    if (password.length < 8) { setError('give that password a little more personality - use at least 8 characters.'); return }
    setBusy(true)
    try {
      if (signup) { const result = await signUp(name, email.trim(), password, asPronounSet(pronounSet)); if (result.requiresEmailConfirmation) { setConfirmationNeeded(true); return }; navigate('/pair', { replace: true }) }
      else { await signIn(email.trim(), password); navigate('/pair', { replace: true }) }
    } catch (authError) { setError(friendlyAuthError(authError as Error)) } finally { setBusy(false) }
  }
  if (confirmationNeeded) return <main className="auth-page page-shell"><ComicCard accent="yellow" className="auth-card confirmation-card"><div className="auth-star">*</div><p className="eyebrow">one last boring thing</p><h1>check your inbox.</h1><p>we sent you the boring-but-important part.</p><Link className="auth-link-button" to="/auth/signin">Return to sign in -&gt;</Link></ComicCard></main>
  return <main className="auth-page page-shell"><motion.section className="auth-shell" initial={{ opacity: 0, y: 14, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={modalEnter}><div className="auth-side-note">this form is legally<br />very important probably</div><ComicCard accent={signup ? 'lavender' : 'blue'} className="auth-card"><div className="auth-sticker">OUR SPACE ID</div><p className="eyebrow">security unfortunately requires paperwork</p><h1>{signup ? 'identify yourself, stranger.' : 'welcome back, troublemaker.'}</h1><form onSubmit={submit} noValidate>{signup && <><label className="auth-field"><span><UserRound size={15} /> Name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="your extremely good name" disabled={busy} /></label><label className="auth-field"><span>How should we refer to you?</span><select value={pronounSet} onChange={(event) => setPronounSet(event.target.value)} disabled={busy}>{pronounOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>Used only for the silly he/she/they copy.</small></label></>}<label className="auth-field"><span><Mail size={15} /> Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" disabled={busy} /></label><label className="auth-field"><span><KeyRound size={15} /> Password</span><span className="password-input"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="at least 8 characters" disabled={busy} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label><AnimatePresence>{error && <motion.p className="auth-error" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [0, -3, 3, 0] }} exit={{ opacity: 0 }} transition={{ duration: .28 }}>{error}</motion.p>}</AnimatePresence><AnimatedButton type="submit" tone="coral" className="auth-submit" disabled={busy}>{busy ? 'checking the paperwork...' : signup ? 'Create my account' : 'Let me in'}</AnimatedButton></form><p className="auth-switch">{signup ? 'already part of this disaster?' : 'new here?'} <Link to={signup ? '/auth/signin' : '/auth/signup'}>{signup ? 'Sign in -&gt;' : 'Create account -&gt;'}</Link></p></ComicCard></motion.section></main>
}
