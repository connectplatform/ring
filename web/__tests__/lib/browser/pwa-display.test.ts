import { describe, expect, it } from '@jest/globals'
import {
  canOfferHomeScreenInstall,
  isIosSafariFromUa,
  needsIosHomeScreenForPushFromState,
} from '@/lib/browser/pwa-display'

const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.71 Mobile/15E148 Safari/604.1'
const TELEGRAM_IOS_WEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const MACOS_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

describe('pwa-display iOS Safari install CTA', () => {
  it('accepts iPhone Safari and iPad desktop-site Safari', () => {
    expect(isIosSafariFromUa(SAFARI_IPHONE, 'iPhone', 5)).toBe(true)
    expect(isIosSafariFromUa(MACOS_SAFARI, 'MacIntel', 5)).toBe(true)
  })

  it('rejects Chrome iOS, Telegram-like WKWebView, and macOS Safari tabs', () => {
    expect(isIosSafariFromUa(CHROME_IPHONE, 'iPhone', 5)).toBe(false)
    expect(isIosSafariFromUa(TELEGRAM_IOS_WEBVIEW, 'iPhone', 5)).toBe(false)
    expect(isIosSafariFromUa(MACOS_SAFARI, 'MacIntel', 0)).toBe(false)
  })

  it('shows Home Screen install only for Safari iOS tabs without PushManager', () => {
    expect(
      needsIosHomeScreenForPushFromState({
        isTelegramMiniApp: false,
        isIosSafari: true,
        isStandalone: false,
        hasPushManager: false,
      }),
    ).toBe(true)
  })

  it('never shows the install CTA in Telegram Mini App or installed PWA', () => {
    expect(
      needsIosHomeScreenForPushFromState({
        isTelegramMiniApp: true,
        isIosSafari: true,
        isStandalone: false,
        hasPushManager: false,
      }),
    ).toBe(false)
    expect(
      needsIosHomeScreenForPushFromState({
        isTelegramMiniApp: false,
        isIosSafari: true,
        isStandalone: true,
        hasPushManager: false,
      }),
    ).toBe(false)
    expect(
      needsIosHomeScreenForPushFromState({
        isTelegramMiniApp: false,
        isIosSafari: false,
        isStandalone: false,
        hasPushManager: false,
      }),
    ).toBe(false)
  })
})

describe('home screen install offer', () => {
  it('shows for iOS Safari tabs and Chromium only after the install prompt', () => {
    expect(canOfferHomeScreenInstall({
      isStandalone: false,
      isTelegram: false,
      isIosDevice: true,
      isIosSafari: true,
      hasInstallPrompt: false,
    })).toBe(true)
    expect(canOfferHomeScreenInstall({
      isStandalone: false,
      isTelegram: false,
      isIosDevice: true,
      isIosSafari: false,
      hasInstallPrompt: true,
    })).toBe(false)
    expect(canOfferHomeScreenInstall({
      isStandalone: false,
      isTelegram: true,
      isIosDevice: false,
      isIosSafari: false,
      hasInstallPrompt: true,
    })).toBe(false)
    expect(canOfferHomeScreenInstall({
      isStandalone: true,
      isTelegram: false,
      isIosDevice: false,
      isIosSafari: false,
      hasInstallPrompt: true,
    })).toBe(false)
    expect(canOfferHomeScreenInstall({
      isStandalone: false,
      isTelegram: false,
      isIosDevice: false,
      isIosSafari: false,
      hasInstallPrompt: false,
    })).toBe(false)
    expect(canOfferHomeScreenInstall({
      isStandalone: false,
      isTelegram: false,
      isIosDevice: false,
      isIosSafari: false,
      hasInstallPrompt: true,
    })).toBe(true)
  })
})
