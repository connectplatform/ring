'use client'

import React, { useState, useEffect } from 'react'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { RingContentPanel } from '@/components/layout/ring-app-shell'
import { cn } from '@/lib/utils'

interface RingRightRailLayoutProps {
  children: React.ReactNode
  rightRail?: React.ReactNode
  /** When false, center content only (form/detail pages manage their own rail). */
  showRightRail?: boolean
  className?: string
  contentClassName?: string
  isOpen?: boolean
  onToggle?: (isOpen: boolean) => void
}

/**
 * Store / vendor-start SSOT: center panel + transparent right rail + FloatingSidebarToggle on mobile.
 */
export default function RingRightRailLayout({
  children,
  rightRail,
  showRightRail = true,
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

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  const rail = showRightRail ? rightRail : null

  return (
    <div className={cn('min-h-full text-foreground relative transition-colors duration-300', className)}>
      {/* Desktop */}
      <div className="hidden min-h-full gap-3 lg:flex">
        <RingContentPanel className={cn('relative flex-1 min-w-0', contentClassName)}>
          {children}
        </RingContentPanel>
        {rail && (
          <aside className="ring-right-rail w-[300px] shrink-0 self-stretch min-h-0">
            <div className="sticky top-0 px-3 pt-4 pb-6 pr-4">{rail}</div>
          </aside>
        )}
      </div>

      {/* Tablet */}
      <div className="hidden min-h-full md:block lg:hidden">
        <RingContentPanel className={cn('relative min-h-full', contentClassName)}>
          {children}
          {rail && (
            <FloatingSidebarToggle
              isOpen={isOpen}
              onToggle={setIsOpen}
              mobileWidth="90%"
              tabletWidth="380px"
            >
              {rail}
            </FloatingSidebarToggle>
          )}
        </RingContentPanel>
      </div>

      {/* Mobile */}
      <div className="md:hidden px-1 pb-4">
        <RingContentPanel className={cn('relative min-h-full', contentClassName)}>
          {children}
          {rail && (
            <FloatingSidebarToggle
              isOpen={isOpen}
              onToggle={setIsOpen}
              mobileWidth="90%"
              tabletWidth="380px"
            >
              {rail}
            </FloatingSidebarToggle>
          )}
        </RingContentPanel>
      </div>
    </div>
  )
}
