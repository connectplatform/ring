'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname, replaceLocalePath } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { Moon, Sun, Check } from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import { SUPPORTED_LOCALES } from '@/lib/locale-config'
import {
  localeDisplayLabel,
  localeFlagEmoji,
  localeNativeTitle,
  persistRingLocalePreference,
} from '@/lib/locale-pref'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/** Docs right-sidebar header: icon theme toggle + locale dropdown (flag + code). */
export default function DocsSidebarControls() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const switchLocale = useCallback(
    (newLocale: Locale) => {
      setOpen(false)
      if (newLocale === locale) return
      persistRingLocalePreference(newLocale)
      replaceLocalePath(router, pathname, newLocale)
    },
    [locale, pathname, router],
  )

  return (
    <div className="flex items-center gap-1 shrink-0">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs font-medium gap-1"
            aria-label={`Language: ${localeNativeTitle(locale)}`}
          >
            <span aria-hidden>{localeFlagEmoji(locale)}</span>
            <span>{localeDisplayLabel(locale)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          {SUPPORTED_LOCALES.map((loc) => {
            const active = loc === locale
            return (
              <DropdownMenuItem
                key={loc}
                onClick={() => switchLocale(loc)}
                className={cn('flex items-center justify-between gap-3', active && 'bg-accent')}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>{localeFlagEmoji(loc)}</span>
                  <span>{localeNativeTitle(loc)}</span>
                </span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
        aria-label="Toggle theme"
        suppressHydrationWarning
      >
        {!mounted ? (
          <Sun className="h-4 w-4" aria-hidden />
        ) : resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4" aria-hidden />
        ) : (
          <Sun className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </div>
  )
}
