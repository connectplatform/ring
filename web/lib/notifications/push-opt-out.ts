/** localStorage flag so Disable is not undone by the auto-init effect. */

export const RING_PUSH_OPT_OUT_KEY = 'ring_push_opt_out'

export function isPushOptedOut(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(RING_PUSH_OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function setPushOptedOut(optOut: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (optOut) {
      window.localStorage.setItem(RING_PUSH_OPT_OUT_KEY, '1')
    } else {
      window.localStorage.removeItem(RING_PUSH_OPT_OUT_KEY)
    }
  } catch {
    // Private mode / quota — disable still unregisters server rows this session.
  }
}
