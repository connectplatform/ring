'use client'

import React, { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface RightSidebarProps {
  children: React.ReactNode
  title?: string
  actions?: React.ReactNode
  className?: string
  sticky?: boolean
  /** @deprecated Bottom theme/lang bar removed — pass controls via `actions` (docs sidebar). */
  showControls?: boolean
  onLinkClick?: () => void
}

export default function RightSidebar({
  children,
  title,
  actions,
  className,
  sticky = true,
  onLinkClick,
}: RightSidebarProps) {
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

  return (
    <div 
      className={cn(
        'w-full bg-transparent',
        'hidden lg:flex lg:flex-col',
        sticky && 'sticky top-0 max-h-[calc(100dvh-2.5rem)]',
        className
      )}
      data-right-sidebar="true"
    >
      {/* Header */}
      {(title || actions) && (
        <div className="border-b border-border/40 bg-transparent p-4">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {title && (
              <h3 className="font-semibold text-lg truncate min-w-0">{title}</h3>
            )}
            {actions && (
              <div className="flex items-center gap-1 shrink-0">
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
    </div>
  )
}
