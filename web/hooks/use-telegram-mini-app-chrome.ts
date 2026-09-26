'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, type AppRouter } from '@/i18n/routing'
import {
  isTelegramMiniAppFromSignals,
  readTelegramMiniAppSignals,
} from '@/lib/browser/telegram-webapp'
import {
  applyCssVars,
  clearCssVars,
  cssVarsFromSafeArea,
  cssVarsFromThemeParams,
  isPeerGamesPath,
  TG_SAFE_AREA_VARS,
  TG_THEME_VARS,
  type TelegramSafeAreaInset,
  type TelegramThemeParams,
} from '@/lib/browser/telegram-mini-app-chrome'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

type TelegramWebAppChrome = {
  ready?: () => void
  expand?: () => void
  themeParams?: TelegramThemeParams
  safeAreaInset?: TelegramSafeAreaInset
  contentSafeAreaInset?: TelegramSafeAreaInset
  onEvent?: (event: string, cb: () => void) => void
  offEvent?: (event: string, cb: () => void) => void
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
}

const THEME_VAR_NAMES = Object.values(TG_THEME_VARS)

function readWebApp(): TelegramWebAppChrome | null {
  if (typeof window === 'undefined') return null
  return (
    (window as unknown as { Telegram?: { WebApp?: TelegramWebAppChrome } }).Telegram
      ?.WebApp ?? null
  )
}

function paintChrome(inMiniApp: boolean): void {
  const root = document.documentElement
  if (!inMiniApp) {
    root.removeAttribute('data-telegram-mini-app')
    clearCssVars(root, THEME_VAR_NAMES)
    clearCssVars(root, TG_SAFE_AREA_VARS)
    return
  }
  root.setAttribute('data-telegram-mini-app', '')
  const tg = readWebApp()
  applyCssVars(root, cssVarsFromThemeParams(tg?.themeParams))
  applyCssVars(root, cssVarsFromSafeArea(tg?.safeAreaInset, tg?.contentSafeAreaInset))
}

/**
 * READY_EXPAND once per WebView, themeParams and Telegram insets only inside Mini App.
 * Does not override DaVinci CSS variables. BackButton is opt-in via ring-config.
 */
export function useTelegramMiniAppChromeSync(enabled = true): void {
  const pathname = usePathname()
  const router = useRouter()
  const didReady = useRef(false)
  const [inMiniApp, setInMiniApp] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let attached = false
    const onTheme = () => paintChrome(true)
    const onSafe = () => paintChrome(true)

    const attach = (): boolean => {
      const signals = readTelegramMiniAppSignals()
      const inside = signals ? isTelegramMiniAppFromSignals(signals) : false
      if (!inside) return false
      const tg = readWebApp()
      if (!didReady.current) {
        tg?.ready?.()
        tg?.expand?.()
        didReady.current = true
      }
      paintChrome(true)
      setInMiniApp(true)
      if (!attached) {
        tg?.onEvent?.('themeChanged', onTheme)
        tg?.onEvent?.('safeAreaChanged', onSafe)
        tg?.onEvent?.('contentSafeAreaChanged', onSafe)
        attached = true
      }
      return true
    }

    let tick = 0
    let stop = 0
    if (!attach()) {
      tick = window.setInterval(() => {
        if (attach()) window.clearInterval(tick)
      }, 120)
      stop = window.setTimeout(() => window.clearInterval(tick), 4000)
    }

    return () => {
      if (tick) window.clearInterval(tick)
      if (stop) window.clearTimeout(stop)
      const tg = readWebApp()
      try {
        tg?.offEvent?.('themeChanged', onTheme)
        tg?.offEvent?.('safeAreaChanged', onSafe)
        tg?.offEvent?.('contentSafeAreaChanged', onSafe)
      } catch {
        /* ignore */
      }
      // Do not paintChrome(false) here: React Strict Mode remount would flash
      // and drop theme/safe-area mid Mini App. Clear only when disabled.
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      paintChrome(false)
      try {
        readWebApp()?.BackButton?.hide()
      } catch {
        /* ignore */
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !inMiniApp) return
    const backHref = getSystemConfigSnapshot().telegramMiniApp?.backButtonHref
    if (!backHref || isPeerGamesPath(pathname)) return
    const back = readWebApp()?.BackButton
    if (!back) return

    const onBack = () => {
      // Clone-only paths such as /n9 are not in Layer1 Pathname union.
      router.push(backHref as Parameters<AppRouter['push']>[0])
    }
    back.onClick(onBack)
    back.show()
    return () => {
      try {
        // offClick only. hide() here races the peer-games BackButton on /games
        // and violates BACKBUTTON_VISIBLE (never hide without replacement).
        back.offClick(onBack)
      } catch {
        /* ignore */
      }
    }
  }, [enabled, inMiniApp, pathname, router])
}
