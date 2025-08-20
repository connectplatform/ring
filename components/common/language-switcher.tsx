'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { routing } from '@/i18n-config'
import type { Locale } from '@/i18n-config'
import { useTransition } from 'react'

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const [isPending, startTransition] = useTransition()

  const switchLocale = (newLocale: Locale) => {
    // Use startTransition to prevent the page from redirecting during locale switch
    startTransition(() => {
      // Replace the current locale in the pathname with smooth client-side navigation
      const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
      const newPath = `/${newLocale}${pathWithoutLocale}`
      
      // Use replace to maintain the current page without triggering auth checks
      router.replace(newPath, { scroll: false })
    })
  }

  const currentLocale = locale || routing.defaultLocale
  const nextLocale = currentLocale === 'en' ? 'uk' : 'en'

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
