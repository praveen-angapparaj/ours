export function isCallTransitionRace(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('invalid_transition') || message.includes('call_not_found')
}
