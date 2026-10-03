import type { ReactNode } from 'react'

type StickerProps = { children: ReactNode; tone?: 'coral' | 'yellow' | 'lavender' | 'blue' | 'mint' | 'paper'; className?: string }

export function Sticker({ children, tone = 'yellow', className = '' }: StickerProps) {
  return <span className={`sticker sticker-${tone} ${className}`}>{children}</span>
}
