'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTheme } from 'next-themes'
import { ChevronLeft, ChevronRight, Languages, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n-config'

interface FloatingSidebarToggleProps {
  children: React.ReactNode
  className?: string
  isOpen?: boolean
  onToggle?: (isOpen: boolean) => void
  showControls?: boolean // Show theme/lang controls at bottom
  showFloatingButton?: boolean // Show internal floating toggle button (default: true)
  mobileWidth?: string // Width on mobile (default: 85%)
  tabletWidth?: string // Width on iPad/tablet (default: 320px)
}

export default function FloatingSidebarToggle({ 
  children, 
  className, 
  isOpen: controlledIsOpen, 
  onToggle,
  showControls = true,
  showFloatingButton = true,
  mobileWidth = '85%',
  tabletWidth = '320px'
}: FloatingSidebarToggleProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const { setTheme, theme, resolvedTheme } = useTheme()
  
  // Prevent hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  
  // Memoize setIsOpen to prevent useEffect dependency changes on every render (React 19 pattern)
  const setIsOpen = useCallback((value: boolean) => {
    if (onToggle) {
      onToggle(value)
    } else {
      setInternalIsOpen(value)
    }
  }, [onToggle])

  const toggleSidebar = useCallback(() => {
    setIsOpen(!isOpen)
  }, [isOpen, setIsOpen])

  // Auto-hide on link click (mobile/iPad) - Enhanced for touch devices
  useEffect(() => {
    if (!isOpen) return

    const handleInteraction = (e: Event) => {
      const target = e.target as HTMLElement
      const sidebar = document.querySelector('[data-floating-sidebar="true"]')
      
      if (sidebar && sidebar.contains(target)) {
        // If clicking/tapping a link inside sidebar, close it
        // Check for both <a> tags and Next.js Link components (which render as <a>)
        const linkElement = target.closest('a[href]')
        if (linkElement) {
          setTimeout(() => setIsOpen(false), 150) // Small delay for smooth transition
        }
      }
    }

    // Listen for both click (desktop/iPad) and touchend (mobile) events
    document.addEventListener('click', handleInteraction)
    document.addEventListener('touchend', handleInteraction)
    
    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchend', handleInteraction)
    }
  }, [isOpen, setIsOpen])

  // Smart 2-mode language toggle
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
    localStorage.setItem('ring-locale', newLocale)
    document.cookie = `ring-locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`

    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/'
    const newPath = `/${newLocale}${pathWithoutLocale}`
    router.replace(newPath, { scroll: false })
  }, [pathname, router])

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

  const currentTheme = theme === 'system' ? resolvedTheme : theme

  return (
    <>
      {/* Floating Toggle Button - Only visible on mobile (controlled by showFloatingButton prop) */}
      {showFloatingButton && mounted && (
        <div className="lg:hidden fixed top-1/2 right-4 z-50 transform -translate-y-1/2">
          <Button
            onClick={toggleSidebar}
            size="sm"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-all duration-200"
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isOpen ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile/iPad Sidebar with Responsive Controls */}
      <div
          className={cn(
            "lg:hidden fixed top-0 right-0 z-50 h-full bg-background border-l border-border shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col",
            isOpen ? "translate-x-0" : "translate-x-full",
            className
          )}
          style={{
            width: `clamp(280px, ${mobileWidth}, 90vw)`, // Mobile: 90%, iPad: 280px
          }}
          data-floating-sidebar="true"
        >
        {/* Top Controls (Mobile only - avoids z-9000 mobile menu overlap) */}
        {showControls && (
          <div className="md:hidden p-3 border-b border-border bg-background/95 sticky top-0 z-10">
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

              {/* Theme Toggle - with skeleton placeholder during mount */}
              {mounted ? (
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
              ) : (
                <div className="h-8 flex-1 rounded-md border border-border bg-muted/50 animate-pulse" />
              )}
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* Bottom Controls (iPad only - hidden on mobile to avoid menu overlap) */}
        {showControls && (
          <div className="hidden md:block p-4 border-t border-border bg-background/95">
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

              {/* Theme Toggle - with skeleton placeholder during mount */}
              {mounted ? (
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
              ) : (
                <div className="h-8 flex-1 rounded-md border border-border bg-muted/50 animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}



