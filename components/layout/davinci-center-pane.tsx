'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { HeroAmbient, davinciPanelSurface } from '@/lib/ui/davinci'

export interface DavinciCenterPaneProps {
  children: ReactNode
  header?: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * DaVinci glass center pane — fills a flush RingContentPanel edge-to-edge.
 * Use inside RingRightRailLayout with flushCenterPane for customer-facing modules.
 */
export function DavinciCenterPane({
  children,
  header,
  className,
  contentClassName,
}: DavinciCenterPaneProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-full w-full flex-col overflow-hidden rounded-xl',
        davinciPanelSurface,
        className,
      )}
    >
      <HeroAmbient className="pointer-events-none absolute inset-0 opacity-30" />
      <div
        className={cn(
          // Default padding; callers may override with Tailwind !p-* (cn does not twMerge)
          'relative z-[1] flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5',
          contentClassName,
        )}
      >
        {header ? <div className="mb-6 shrink-0">{header}</div> : null}
        {/* Keep children as the flex column root so chat threads can fill height */}
        {children}
      </div>
    </div>
  )
}
