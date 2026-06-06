'use client'

import { replaceLocalePath, useRouter, usePathname } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import {
  localeDisplayLabel,
  nextLocaleInRoutingOrder,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import { useTransition } from 'react'

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const [isPending, startTransition] = useTransition()

  const switchLocale = (newLocale: Locale) => {
    startTransition(() => {
      persistRingLocalePreference(newLocale)
      replaceLocalePath(router, pathname, newLocale)
    })
  }

  const currentLocale = locale || (routing.defaultLocale as Locale)
  const nextLocale = nextLocaleInRoutingOrder(currentLocale)

  return (
    <button
      onClick={() => switchLocale(nextLocale)}
      className="flex items-center space-x-1 text-sm underline"
      type="button"
      disabled={isPending}
    >
      <span className={isPending ? 'opacity-50' : ''}>
        {localeDisplayLabel(currentLocale)}
      </span>
    </button>
  )
}
