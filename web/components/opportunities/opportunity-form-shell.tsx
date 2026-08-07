'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'

export interface OpportunityFormShellProps {
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * DaVinci center-pane shell for add/edit opportunity forms.
 * Fills the ring content panel edge-to-edge (parent should use flushCenterPane).
 */
export function OpportunityFormShell({
  icon: Icon,
  title,
  description,
  children,
  className,
}: OpportunityFormShellProps) {
  return (
    <DavinciCenterPane
      className={className}
      header={
        <header className="border-b border-[color-mix(in_oklch,var(--davinci-beam)_18%,transparent)] pb-5">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
                'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
              )}
            >
              <Icon className="h-5 w-5 text-[var(--davinci-beam)]" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
        </header>
      }
    >
      {children}
    </DavinciCenterPane>
  )
}

export function OpportunityFormSection({
  title,
  children,
  icon: Icon,
  className,
}: {
  title: string
  children: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <section
      className={cn(
        'space-y-4 rounded-xl border border-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)]',
        'bg-[color-mix(in_oklch,var(--davinci-surface-bg)_55%,transparent)] p-4 sm:p-5',
        className,
      )}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]" /> : null}
        {title}
      </h3>
      {children}
    </section>
  )
}
