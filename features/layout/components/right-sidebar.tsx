'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface RightSidebarProps {
  children: React.ReactNode
  title?: string
  actions?: React.ReactNode
  className?: string
  sticky?: boolean
}

export default function RightSidebar({
  children,
  title,
  actions,
  className,
  sticky = true
}: RightSidebarProps) {
  return (
    <div className={cn(
      "w-80 bg-background border-l border-border",
      "hidden lg:flex lg:flex-col",
      sticky && "sticky top-0 h-screen",
      className
    )}>
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
    </div>
  )
}
