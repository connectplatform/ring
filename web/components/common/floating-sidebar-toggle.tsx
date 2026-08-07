'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePathname } from '@/i18n/routing'
import { useTheme } from 'next-themes'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { ChevronRight, Moon, Settings, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocaleCodeMenu } from '@/components/common/locale-code-menu'
import { cn } from '@/lib/utils'

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
  const pathname = usePathname()
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

  // Close when route changes (after in-sidebar link navigation completes).
  // Avoid touchend-to-close: on mobile it can race link click and cancel navigation.
  useEffect(() => {
    setIsOpen(false)
  }, [pathname, setIsOpen])

  const controlsRow = (
    <div className="flex items-center justify-center gap-2">
      <LocaleCodeMenu variant="panel" align="start" />

      {mounted ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleThemeWithTransition(setTheme, theme, resolvedTheme)}
          className="h-8 px-2 text-xs hover:bg-accent flex-1"
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? (
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
  )

  return (
    <>
      {/* Floating Toggle Button - Only visible on mobile (controlled by showFloatingButton prop) */}
      {showFloatingButton && mounted && (
        <div
          className="lg:hidden fixed top-1/2 right-4 z-50 transform -translate-y-1/2"
          data-floating-sidebar-toggle-btn=""
        >
          <Button
            onClick={toggleSidebar}
            size="sm"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg bg-background/90 backdrop-blur-sm border border-border hover:bg-background transition-all duration-200"
            aria-label={isOpen ? 'Close settings sidebar' : 'Open settings sidebar'}
          >
            {isOpen ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <Settings className="h-5 w-5" />
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
            {controlsRow}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* Bottom Controls (iPad only - hidden on mobile to avoid menu overlap) */}
        {showControls && (
          <div className="hidden md:block p-4 border-t border-border bg-background/95">
            {controlsRow}
          </div>
        )}
      </div>
    </>
  )
}
