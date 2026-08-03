'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BorderBeam } from './border-beam'
import { davinciAuthButtonLift, davinciBeamInnerSurface, davinciGlassSurface } from './glass-surface'

export interface DavinciGlassPanelProps {
  title?: ReactNode
  description?: string
  icon?: ReactNode
  children?: ReactNode
  className?: string
  innerClassName?: string
  beamDuration?: string
}

/**
 * DaVinci glass section panel for right-rail sidebars (publisher, membership, home).
 */
export function DavinciGlassPanel({
  title,
  description,
  icon,
  children,
  className,
  innerClassName,
  beamDuration = '7s',
}: DavinciGlassPanelProps) {
  return (
    <BorderBeam
      duration={beamDuration}
      className={cn(davinciGlassSurface, davinciAuthButtonLift, 'rounded-[15px]', className)}
      innerClassName={cn(davinciBeamInnerSurface, 'p-4', innerClassName)}
    >
      {(title || description) && (
        <div className="mb-3 space-y-1.5">
          {title ? (
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
              {icon ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] text-[var(--davinci-beam)]">
                  {icon}
                </span>
              ) : null}
              <span className="min-w-0 truncate">{title}</span>
            </div>
          ) : null}
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </BorderBeam>
  )
}

const davinciChipClassName = cn(
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
  'border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)]',
  'bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]',
  'text-foreground/90',
  'transition-colors duration-150',
)

export function DavinciGlassChip({
  children,
  className,
  icon,
  href,
  external = false,
}: {
  children: ReactNode
  className?: string
  icon?: ReactNode
  href?: string
  external?: boolean
}) {
  const chipClassName = cn(
    davinciChipClassName,
    href &&
      'hover:border-[color-mix(in_oklch,var(--davinci-beam)_45%,transparent)] hover:bg-[color-mix(in_oklch,var(--davinci-beam)_14%,transparent)]',
    className,
  )

  if (href) {
    return (
      <a
        href={href}
        className={chipClassName}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {icon}
        {children}
      </a>
    )
  }

  return (
    <span className={chipClassName}>
      {icon}
      {children}
    </span>
  )
}
