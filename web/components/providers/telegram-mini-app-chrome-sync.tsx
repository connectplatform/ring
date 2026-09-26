'use client'

import { useTelegramMiniAppChromeSync } from '@/hooks/use-telegram-mini-app-chrome'

/** Mount inside I18nProvider (LocaleAppChrome). No-ops outside Telegram Mini App. */
export function TelegramMiniAppChromeSync() {
  useTelegramMiniAppChromeSync()
  return null
}
