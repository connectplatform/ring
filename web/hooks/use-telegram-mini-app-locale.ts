'use client'

import { useEffect, useRef } from 'react'
import { useLocale } from 'next-intl'
import { replaceLocalePath, usePathname, useRouter } from '@/i18n/routing'
import {
  isTelegramMiniAppFromSignals,
  readTelegramLanguageCode,
  readTelegramMiniAppSignals,
} from '@/lib/browser/telegram-webapp'
import { localeFromTelegramLanguageCode } from '@/lib/locale-config'
import { persistRingLocalePreference } from '@/lib/locale-pref'
import type { Locale } from '@/i18n/shared'

/**
 * Align next-intl with the Telegram client language (not Accept-Language).
 * Mini App WebViews often send en Accept-Language while the app UI is uk/ru.
 */
export function useTelegramMiniAppLocaleSync(enabled = true): void {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const didSync = useRef(false)

  useEffect(() => {
    if (!enabled || didSync.current) return

    const attempt = (): boolean => {
      if (didSync.current) return true
      const signals = readTelegramMiniAppSignals()
      const inMiniApp = signals ? isTelegramMiniAppFromSignals(signals) : false
      const code = readTelegramLanguageCode()
      if (!inMiniApp && !code) return false
      const next = localeFromTelegramLanguageCode(code)
      if (!next) {
        if (inMiniApp && !code) return false
        didSync.current = true
        return true
      }
      didSync.current = true
      persistRingLocalePreference(next)
      if (next !== locale) {
        replaceLocalePath(router, pathname, next)
      }
      return true
    }

    if (attempt()) return

    const tick = window.setInterval(() => {
      if (attempt()) window.clearInterval(tick)
    }, 120)
    const stop = window.setTimeout(() => window.clearInterval(tick), 4000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(stop)
    }
  }, [enabled, locale, pathname, router])
}
