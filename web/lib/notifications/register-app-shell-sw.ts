/** App-shell worker so Chromium can treat the site as installable before push permission. */

export const FCM_SW_URL = '/firebase-messaging-sw.js'
export const RFC_SW_URL = '/push-sw.js'

export async function registerAppShellServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const existingFcm = await navigator.serviceWorker.getRegistration(FCM_SW_URL)
    if (existingFcm) return
    const existingRfc = await navigator.serviceWorker.getRegistration(RFC_SW_URL)
    if (!existingRfc) {
      await navigator.serviceWorker.register(RFC_SW_URL, {
        scope: '/',
        updateViaCache: 'none',
      })
    }
  } catch (error) {
    console.warn('App shell service worker registration failed:', error)
  }
}
