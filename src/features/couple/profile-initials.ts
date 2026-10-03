export function profileInitials(displayName: string | null | undefined, fallback = '?') {
  const words = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return fallback.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}
