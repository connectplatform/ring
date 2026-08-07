'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { davinciAuthButtonLift, davinciPanelSurface } from './glass-surface'

export interface DavinciRailLinkProps {
  href: string
  title: string
  hint?: string
  icon: React.ReactNode
  className?: string
  external?: boolean
}

/**
 * Right-rail / sidebar CTA row — theme-aware DaVinci panel surface.
 */
export function DavinciRailLink({
  href,
  title,
  hint,
  icon,
  className,
  external = false,
}: DavinciRailLinkProps) {
  const surface = cn(
    davinciPanelSurface,
    davinciAuthButtonLift,
    'flex w-full items-center gap-3 p-3 text-left',
    className,
  )

  const body = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] text-[var(--davinci-beam)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {hint ? <div className="truncate text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </>
  )

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={surface}>
        {body}
      </a>
    )
  }

  return (
    <Link href={href} className={surface}>
      {body}
    </Link>
  )
}
