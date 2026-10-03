import type { PartnerPresenceStatus } from './presence-types'

const copy: Record<PartnerPresenceStatus, readonly string[]> = {
  online: ['somewhere on the internet', 'online and therefore dangerous', 'currently lurking'],
  in_room: ['waiting for you in our room'],
  away: ['probably doing something suspicious', 'temporarily vanished'],
  offline: ['currently touching grass', 'escaped the internet'],
  unknown: ['status temporarily unknown'],
}

function stableIndex(seed: string, length: number) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) | 0
  return Math.abs(hash) % length
}

export function presenceCopy(status: PartnerPresenceStatus, seed: string) {
  const options = copy[status]
  return options[stableIndex(`${seed}:${status}`, options.length)]
}
