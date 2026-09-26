/** Home Screen / standalone detection — iOS Web Push requires an installed PWA. */

import { isTelegramMiniAppShell } from '@/lib/browser/telegram-webapp'

/** In-app iOS browsers that are not Safari (cannot Add to Home Screen as a web app). */
const IOS_NON_SAFARI =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|YaBrowser|SamsungBrowser|GSA\//i

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const media = window.matchMedia?.('(display-mode: standalone)')?.matches === true
  const iosLegacy =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return media || iosLegacy
}

export function isIosDeviceFromUa(
  ua: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  )
}

/**
 * Real iOS/iPadOS Safari (including iPad desktop-site mode).
 * Excludes Chrome/Firefox/Edge iOS, Google app, and Telegram WebViews.
 */
export function isIosSafariFromUa(
  ua: string,
  platform: string,
  maxTouchPoints: number,
): boolean {
  if (!isIosDeviceFromUa(ua, platform, maxTouchPoints)) return false
  if (IOS_NON_SAFARI.test(ua)) return false
  return /Safari\//.test(ua) && /Version\//.test(ua)
}

export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  if (isTelegramMiniAppShell()) return false
  const nav = window.navigator
  return isIosSafariFromUa(nav.userAgent || '', nav.platform || '', nav.maxTouchPoints || 0)
}

/** iPhone/iPad running as a browser tab, not a Home Screen web app (any iOS browser). */
export function isIosBrowserTab(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent || ''
  const iOS = isIosDeviceFromUa(
    ua,
    window.navigator.platform || '',
    window.navigator.maxTouchPoints || 0,
  )
  return iOS && !isStandaloneDisplay()
}

export function needsIosHomeScreenForPushFromState(opts: {
  isTelegramMiniApp: boolean
  isIosSafari: boolean
  isStandalone: boolean
  hasPushManager: boolean
}): boolean {
  if (opts.isTelegramMiniApp) return false
  if (!opts.isIosSafari) return false
  if (opts.isStandalone) return false
  return !opts.hasPushManager
}

/**
 * Install-for-push CTA only: iOS Safari tab, not Mini App, not Chrome iOS, not PWA.
 * iOS Web Push exists only after Add to Home Screen (iOS 16.4+).
 */
export function needsIosHomeScreenForPush(): boolean {
  if (typeof window === 'undefined') return false
  return needsIosHomeScreenForPushFromState({
    isTelegramMiniApp: isTelegramMiniAppShell(),
    isIosSafari: isIosSafari(),
    isStandalone: isStandaloneDisplay(),
    hasPushManager: 'PushManager' in window,
  })
}
