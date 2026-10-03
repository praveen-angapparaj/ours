export type PronounSet = 'she_her' | 'he_him' | 'they_them'

export const pronounOptions: Array<{ value: PronounSet; label: string }> = [
  { value: 'she_her', label: 'She / her' },
  { value: 'he_him', label: 'He / him' },
  { value: 'they_them', label: 'They / them' },
]

export function asPronounSet(value: string | null | undefined): PronounSet {
  return value === 'she_her' || value === 'he_him' || value === 'they_them' ? value : 'they_them'
}

export function pronounsFor(value: string | null | undefined) {
  const pronounSet = asPronounSet(value)
  if (pronounSet === 'she_her') return { subject: 'she', object: 'her', possessive: 'her' }
  if (pronounSet === 'he_him') return { subject: 'he', object: 'him', possessive: 'his' }
  return { subject: 'they', object: 'them', possessive: 'their' }
}
