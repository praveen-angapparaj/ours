import { motion } from 'motion/react'

export type EnvelopePhase = 'rest' | 'approach' | 'unseal' | 'open' | 'depart'

export function StarSigil({ size = 24, className }: { size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 2.8C21.6 13.7 26.2 18.3 37.2 20 26.2 21.7 21.6 26.3 20 37.2 18.3 26.3 13.7 21.7 2.8 20 13.7 18.3 18.3 13.7 20 2.8Z" fill="currentColor" /><path d="M31 6.5C31.6 10.3 33.2 11.9 37 12.5 33.2 13.1 31.6 14.7 31 18.5 30.4 14.7 28.8 13.1 25 12.5 28.8 11.9 30.4 10.3 31 6.5Z" fill="currentColor" opacity=".72" /></svg>
}

export function HeartVessel({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 96 88" fill="none" aria-hidden="true"><defs><radialGradient id="vessel-glow" cx="50%" cy="35%" r="66%"><stop stopColor="#FFE6D7" /><stop offset=".46" stopColor="#F59C96" /><stop offset="1" stopColor="#B6536B" /></radialGradient><linearGradient id="vessel-stroke" x1="12" y1="8" x2="82" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF2DF" /><stop offset="1" stopColor="#C85E78" /></linearGradient></defs><path d="M48 81.6C41.5 75.5 11 54.8 11 31.3 11 17.6 20.4 8.4 33.1 8.4c7.3 0 12.5 3.6 14.9 8.2 2.4-4.6 7.6-8.2 14.9-8.2C75.6 8.4 85 17.6 85 31.3 85 54.8 54.5 75.5 48 81.6Z" fill="url(#vessel-glow)" stroke="url(#vessel-stroke)" strokeWidth="2.5" /><path d="M22 25.5C24.2 18.3 31.2 15.8 36.4 17.7" stroke="#FFF8E9" strokeWidth="4" strokeLinecap="round" opacity=".52" /></svg>
}

export function EnvelopeIllustration({ phase = 'rest', className }: { phase?: EnvelopePhase; className?: string }) {
  const flap = phase === 'open' ? { y: -12, rotate: -18 } : phase === 'approach' ? { y: -3, rotate: -3 } : { y: 0, rotate: 0 }
  const seal = phase === 'unseal' || phase === 'open' ? { scale: .15, opacity: 0, y: -8 } : { scale: 1, opacity: 1, y: 0 }
  return <svg className={className} viewBox="0 0 220 150" fill="none" aria-hidden="true">
    <defs><linearGradient id="letter-paper" x1="25" y1="16" x2="192" y2="143" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF9E9" /><stop offset="1" stopColor="#EFCF9D" /></linearGradient><linearGradient id="letter-flap" x1="110" y1="12" x2="110" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFDF4" /><stop offset="1" stopColor="#EABF84" /></linearGradient><radialGradient id="wax-seal"><stop stopColor="#FFB0A4" /><stop offset=".7" stopColor="#D76D78" /><stop offset="1" stopColor="#914155" /></radialGradient></defs>
    <path d="M18 36C18 25.5 26.5 17 37 17h146c10.5 0 19 8.5 19 19v81c0 10.5-8.5 19-19 19H37c-10.5 0-19-8.5-19-19V36Z" fill="url(#letter-paper)" stroke="#8C5962" strokeWidth="2" />
    <path d="m20 41 84.9 61.2a8.8 8.8 0 0 0 10.2 0L200 41" stroke="#C99181" strokeWidth="2" />
    <motion.g animate={flap} transition={{ type: 'spring', stiffness: 180, damping: 22 }} style={{ transformOrigin: '110px 24px' }}><path d="M22 35C22 25 30.1 17 40 17h140c9.9 0 18 8 18 18L110 99 22 35Z" fill="url(#letter-flap)" stroke="#8C5962" strokeWidth="2" /></motion.g>
    <motion.g animate={seal} transition={{ duration: .34, ease: [0.22, 0.9, 0.28, 1] }} style={{ transformOrigin: '110px 62px' }}><circle cx="110" cy="62" r="17" fill="url(#wax-seal)" stroke="#793647" strokeWidth="1.5" /><path d="M103.5 62c2.9-4.6 7.2-4.6 10.1 0 2.9-4.6 7.2-4.6 10.1 0-2.5 4.5-7.7 8.2-10.1 9.8-2.4-1.6-7.6-5.3-10.1-9.8Z" fill="#FFE7D6" opacity=".8" /></motion.g>
  </svg>
}
