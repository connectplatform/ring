'use client'

import React, { useCallback, useEffect } from 'react'
import { useRouter, usePathname, replaceLocalePath } from '@/i18n/routing'
import { useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Languages, Moon, Sun } from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import {
  localeDisplayLabel,
  localeNativeTitle,
  nextLocaleInRoutingOrder,
  persistRingLocalePreference,
} from '@/lib/locale-pref'

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

  const nextLang = nextLocaleInRoutingOrder(locale)

  const switchLocale = useCallback(
    (newLocale: Locale) => {
      persistRingLocalePreference(newLocale)
      replaceLocalePath(router, pathname, newLocale)
    },
    [pathname, router],
  )

  const toggleTheme = useCallback(() => {
    const currentTheme = theme === 'system' ? resolvedTheme : theme
    setTheme(currentTheme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme, resolvedTheme])

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => switchLocale(nextLang)}
              className="h-8 px-2 text-xs hover:bg-accent flex-1"
              title={`Switch to ${localeNativeTitle(nextLang)}`}
            >
              <Languages className="h-3 w-3 mr-1" />
              {localeDisplayLabel(locale)}
              <span className="mx-1">↔</span>
              {localeDisplayLabel(nextLang)}
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
