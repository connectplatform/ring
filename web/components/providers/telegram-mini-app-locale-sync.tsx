'use client'

import { useTelegramMiniAppLocaleSync } from '@/hooks/use-telegram-mini-app-locale'

/** Mount inside I18nProvider (LocaleAppChrome). No-ops outside Telegram Mini App. */
export function TelegramMiniAppLocaleSync() {
  useTelegramMiniAppLocaleSync()
  return null
}
