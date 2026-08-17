/** Home Screen / standalone detection — iOS Web Push requires an installed PWA. */

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const media = window.matchMedia?.('(display-mode: standalone)')?.matches === true
  const iosLegacy =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return media || iosLegacy
}

/** iPhone/iPad Safari (or Chrome on iOS) running as a browser tab, not a Home Screen web app. */
export function isIosBrowserTab(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent || ''
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  return iOS && !isStandaloneDisplay()
}

export function needsIosHomeScreenForPush(): boolean {
  if (typeof window === 'undefined') return false
  if (!isIosBrowserTab()) return false
  return !('PushManager' in window)
}
