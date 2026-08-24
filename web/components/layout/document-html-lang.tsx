'use client'

import { useLocale } from 'next-intl'
import { useEffect } from 'react'

/**
 * Keep <html lang> aligned with next-intl after hydrate / client locale switch.
 * RootLayout cannot await headers() for the path locale (Next.js 16 blocking-route).
 */
export function DocumentHtmlLang() {
  const locale = useLocale()

  useEffect(() => {
    if (locale) document.documentElement.lang = locale
  }, [locale])

  return null
}
