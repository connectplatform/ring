'use client'

import React, { useState, useEffect } from 'react'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { RingContentPanel } from '@/components/layout/ring-app-shell'
import { RING_FLUSH_CENTER_PANE_MOBILE } from '@/components/layout/center-pane-classes'
import { cn } from '@/lib/utils'

interface RingRightRailLayoutProps {
  children: React.ReactNode
  rightRail?: React.ReactNode
  /** When false, center content only (form/detail pages manage their own rail). */
  showRightRail?: boolean
  /** DaVinci immersive: strip default panel padding/bg so center pane fills edge-to-edge. */
  flushCenterPane?: boolean
  className?: string
  contentClassName?: string
  isOpen?: boolean
  onToggle?: (isOpen: boolean) => void
}

/**
 * Store / vendor-start SSOT: center panel + transparent right rail + FloatingSidebarToggle on mobile.
 * Children render once — avoid triplicating client trees (prevents duplicate API calls per breakpoint).
 */
export default function RingRightRailLayout({
  children,
  rightRail,
  showRightRail = true,
  flushCenterPane = false,
  className,
  contentClassName,
  isOpen: controlledIsOpen,
  onToggle,
}: RingRightRailLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = onToggle ?? setInternalIsOpen

  useEffect(() => {
    setMounted(true)
  }, [])

  const rail = showRightRail ? rightRail : null

  return (
    <div className={cn('min-h-full text-foreground relative transition-colors duration-300', className)}>
      <div className="min-h-full lg:flex lg:gap-3">
        <RingContentPanel
          className={cn(
            'relative min-h-full min-w-0 flex-1 px-1 pb-4 md:px-5 md:pb-6 lg:px-6 lg:pb-0',
            flushCenterPane && RING_FLUSH_CENTER_PANE_MOBILE,
            contentClassName,
          )}
        >
          {children}
          {mounted && rail && (
            <div className="lg:hidden">
              <FloatingSidebarToggle
                isOpen={isOpen}
                onToggle={setIsOpen}
                mobileWidth="90%"
                tabletWidth="380px"
              >
                {rail}
              </FloatingSidebarToggle>
            </div>
          )}
        </RingContentPanel>

        {mounted && rail && (
          <aside className="ring-right-rail hidden w-[300px] shrink-0 self-stretch min-h-0 lg:block">
            <div className="sticky top-0 px-3 pt-4 pb-6 pr-4">{rail}</div>
          </aside>
        )}
      </div>
    </div>
  )
}
