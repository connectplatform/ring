'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { routing } from '@/i18n-config'
import type { Locale } from '@/i18n-config'
import { useTransition, useEffect, useState } from 'react'

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const [isPending, startTransition] = useTransition()
  const [storedLocale, setStoredLocale] = useState<Locale | null>(null)

  // Load stored locale on mount
  useEffect(() => {
    const stored = localStorage.getItem('ring-locale') as Locale
    if (stored && routing.locales.includes(stored)) {
      setStoredLocale(stored)
    }
  }, [])

  const switchLocale = (newLocale: Locale) => {
    // Use startTransition to prevent the page from redirecting during locale switch
    startTransition(() => {
      // Store the new locale preference in both localStorage and cookie
      localStorage.setItem('ring-locale', newLocale)
      document.cookie = `ring-locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      setStoredLocale(newLocale)

      // Replace the current locale in the pathname with smooth client-side navigation
      const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
      const newPath = `/${newLocale}${pathWithoutLocale}`

      // Use replace to maintain the current page without triggering auth checks
      router.replace(newPath, { scroll: false })
    })
  }

  const currentLocale = locale || routing.defaultLocale
  // Use stored preference to determine next locale, fallback to alternating between en/uk
  const nextLocale = storedLocale && storedLocale !== currentLocale
    ? storedLocale
    : (currentLocale === 'en' ? 'uk' : 'en')

  return (
    <button
      onClick={() => switchLocale(nextLocale)}
      className="flex items-center space-x-1 text-sm underline"
      type="button"
      disabled={isPending}
    >
      <span className={isPending ? 'opacity-50' : ''}>
        {currentLocale === 'en' ? 'EN' : 'UK'}
      </span>
    </button>
  )
}
