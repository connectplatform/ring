'use client'

import React, { useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Languages, Moon, Sun } from 'lucide-react'
import type { Locale } from '@/i18n-config'

interface RightSidebarProps {
  children: React.ReactNode
  title?: string
  actions?: React.ReactNode
  className?: string
  sticky?: boolean
  showControls?: boolean // Show theme/lang controls at bottom
  onLinkClick?: () => void // Callback when link is clicked (for auto-hide on mobile/iPad)
}

export default function RightSidebar({
  children,
  title,
  actions,
  className,
  sticky = true,
  showControls = true,
  onLinkClick
}: RightSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { setTheme, theme, resolvedTheme } = useTheme()

  // Smart 2-mode language toggle (same logic as desktop sidebar)
  const getSmartLanguageToggle = useCallback(() => {
    const storedLocale = typeof window !== 'undefined' 
      ? (localStorage.getItem('ring-locale') as Locale || locale)
      : locale

    let primaryLang: Locale = storedLocale
    let secondaryLang: Locale = 'en'

    if (primaryLang === 'en') {
      secondaryLang = 'uk'
    } else {
      secondaryLang = 'en'
    }

    const currentLang = locale
    const nextLang = currentLang === primaryLang ? secondaryLang : primaryLang

    return { currentLang, nextLang, primaryLang, secondaryLang }
  }, [locale])

  const switchLocale = useCallback((newLocale: Locale) => {
    // Store the new locale preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('ring-locale', newLocale)
      document.cookie = `ring-locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      
      // Replace the current locale in the pathname
      const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
      const newPath = `/${newLocale}${pathWithoutLocale}`
      
      // Use window.location.href for FULL page reload to get new messages from Server Components
      window.location.href = newPath
    }
  }, [pathname])

  const toggleTheme = useCallback(() => {
    const currentTheme = theme === 'system' ? resolvedTheme : theme
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme, resolvedTheme])

  const getLanguageName = useCallback((locale: string) => {
    switch (locale) {
      case 'en': return 'EN'
      case 'uk': return 'UK'
      case 'ru': return 'RU'
      default: return locale.toUpperCase()
    }
  }, [])

  // Listen for link clicks to trigger auto-hide
  useEffect(() => {
    if (!onLinkClick) return

    const sidebar = document.querySelector('[data-right-sidebar="true"]')
    if (!sidebar) return

    const handleLinkClick = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'A' || target.closest('a')) {
        onLinkClick()
      }
    }

    sidebar.addEventListener('click', handleLinkClick)
    return () => sidebar.removeEventListener('click', handleLinkClick)
  }, [onLinkClick])

  const currentTheme = theme === 'system' ? resolvedTheme : theme

  return (
    <div 
      className={cn(
        "w-80 bg-background border-l border-border",
        "hidden lg:flex lg:flex-col",
        sticky && "sticky top-0 h-screen",
        className
      )}
      data-right-sidebar="true"
    >
      {/* Header */}
      {(title || actions) && (
        <div className="p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between">
            {title && (
              <h3 className="font-semibold text-lg">{title}</h3>
            )}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {children}
        </div>
      </div>

      {/* Bottom Controls (Theme & Language Toggle) - Only show on docs pages */}
      {showControls && pathname.includes('/docs') && (
        <div className="p-4 border-t border-border bg-background/95">
          <div className="flex items-center justify-center gap-2">
            {/* Smart 2-Mode Language Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const { nextLang } = getSmartLanguageToggle()
                switchLocale(nextLang)
              }}
              className="h-8 px-2 text-xs hover:bg-accent flex-1"
              title={`Switch to ${(() => {
                const { nextLang } = getSmartLanguageToggle()
                return nextLang === 'en' ? 'English' : nextLang === 'uk' ? 'Українська' : 'Русский'
              })()}`}
            >
              <Languages className="h-3 w-3 mr-1" />
              {getLanguageName(locale)}
              <span className="mx-1">↔</span>
              {getLanguageName(getSmartLanguageToggle().nextLang)}
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="h-8 px-2 text-xs hover:bg-accent flex-1"
              title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {currentTheme === 'dark' ? (
                <>
                  <Sun className="h-3 w-3 mr-1" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="h-3 w-3 mr-1" />
                  Dark
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
