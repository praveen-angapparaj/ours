export function loadCallMediaProvider() {
  return import('./CallMediaProvider')
}

// Starting this as soon as signaling is accepted means the media bundle is
// normally ready before the token request completes, without putting LiveKit
// in the initial application bundle.
export function preloadCallMediaProvider() {
  void loadCallMediaProvider()
}
