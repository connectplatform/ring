/**
 * Telegram Mini App / in-client WebView detection.
 * Do not treat a bare `Telegram.WebApp` object as Mini App: telegram-web-app.js
 * defines it in ordinary Safari tabs when the script tag is present.
 */

export type TelegramWebAppSnapshot = {
  initData?: string
  platform?: string
  initDataUnsafe?: { user?: { language_code?: string } }
}

export type TelegramMiniAppSignals = {
  pathname: string
  search: string
  hash: string
  hasTelegramWebviewHost: boolean
  webApp: TelegramWebAppSnapshot | null
}

export function isTelegramMiniAppPath(pathname: string): boolean {
  return /(?:^|\/)tg-mini-app(?:\/|$)/.test(pathname)
}

export function isTelegramMiniAppFromSignals(signals: TelegramMiniAppSignals): boolean {
  if (isTelegramMiniAppPath(signals.pathname)) return true
  const blob = `${signals.search}${signals.hash}`
  if (/tgWebApp(Data|Version|Platform)/.test(blob)) return true
  if (signals.hasTelegramWebviewHost) return true
  const initData = signals.webApp?.initData
  return typeof initData === 'string' && initData.length > 0
}

export function readTelegramMiniAppSignals(): TelegramMiniAppSignals | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    TelegramWebviewProxy?: unknown
    TelegramWebview?: unknown
    Telegram?: { WebApp?: TelegramWebAppSnapshot }
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    hasTelegramWebviewHost: Boolean(w.TelegramWebviewProxy || w.TelegramWebview),
    webApp: w.Telegram?.WebApp ?? null,
  }
}

/** True inside Telegram Mini App (any client), including locale-prefixed /tg-mini-app. */
export function isTelegramMiniAppShell(): boolean {
  const signals = readTelegramMiniAppSignals()
  return signals ? isTelegramMiniAppFromSignals(signals) : false
}

/** language_code from Telegram WebApp initData (`user` JSON field). */
export function languageCodeFromTelegramInitData(initData: string): string | null {
  const raw = String(initData || '').trim()
  if (!raw) return null
  try {
    const params = new URLSearchParams(raw)
    const userRaw = params.get('user')
    if (!userRaw) return null
    const user = JSON.parse(userRaw) as { language_code?: unknown }
    return typeof user.language_code === 'string' && user.language_code.trim()
      ? user.language_code.trim()
      : null
  } catch {
    return null
  }
}

export function languageCodeFromTelegramLocation(search: string, hash: string): string | null {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const encoded = hashParams.get('tgWebAppData') || query.get('tgWebAppData')
  if (!encoded) return null
  return languageCodeFromTelegramInitData(encoded)
}

/** Telegram client language: initDataUnsafe, initData, or start-hash tgWebAppData. */
export function readTelegramLanguageCode(): string | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { Telegram?: { WebApp?: TelegramWebAppSnapshot } }
  const unsafe = w.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  if (typeof unsafe === 'string' && unsafe.trim()) return unsafe.trim()
  const initData = w.Telegram?.WebApp?.initData
  if (initData) {
    const fromInit = languageCodeFromTelegramInitData(initData)
    if (fromInit) return fromInit
  }
  return languageCodeFromTelegramLocation(window.location.search, window.location.hash)
}
