'use client'

/**
 * Telegram Mini App BackButton → /games when Telegram.WebApp is present.
 * Reuses existing mini-app initData auth; no TDLib.
 */

import { useEffect } from 'react'
import { useRouter } from '@/i18n/routing'

type TelegramWebAppLike = {
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
}

export function useTelegramGamesBackButton(enabled = true): void {
  const router = useRouter()

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebAppLike } })
      .Telegram?.WebApp
    const back = tg?.BackButton
    if (!back) return

    const onBack = () => {
      router.push('/games')
    }

    back.onClick(onBack)
    back.show()
    return () => {
      try {
        back.offClick(onBack)
        back.hide()
      } catch {
        /* ignore */
      }
    }
  }, [enabled, router])
}
