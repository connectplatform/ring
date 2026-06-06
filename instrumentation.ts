/**
 * Next.js instrumentation – runs once when the Node/edge runtime loads.
 * Replace broken localStorage proxy with a no-op object so build/static generation does not throw.
 */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  key: () => null,
  length: 0,
  clear: () => {},
}

export async function register() {
  const g = globalThis as any
  const storage = g.localStorage ?? g.window?.localStorage
  if (storage && typeof storage.getItem !== 'function') {
    g.localStorage = noopStorage
    if (g.window) g.window.localStorage = noopStorage
  }
}
