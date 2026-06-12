import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppContentShellProps {
  children: ReactNode
  className?: string
}

/** Lab01 outer canvas + inset frame wrapping all md+ page content. */
export function AppContentShell({ children, className }: AppContentShellProps) {
  return (
    <div
      className={cn(
        'min-h-full md:ring-app-canvas md:min-h-[100dvh]',
        'md:pt-2 md:pb-2 md:pl-2 md:pr-0 lg:pt-3 lg:pb-3 lg:pl-3',
        className,
      )}
    >
      <div className="min-h-full md:ring-app-frame md:min-h-[calc(100dvh-0.5rem)] lg:min-h-[calc(100dvh-0.75rem)]">
        {children}
      </div>
    </div>
  )
}

interface RingContentPanelProps {
  children: ReactNode
  className?: string
}

/** Lab01 bright main column — white rounded panel with boundary shadow. */
export function RingContentPanel({ children, className }: RingContentPanelProps) {
  return <div className={cn('ring-content-panel', className)}>{children}</div>
}
