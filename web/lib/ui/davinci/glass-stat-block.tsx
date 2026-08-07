'use client'

import { cn } from '@/lib/utils'
import { BorderBeam } from './border-beam'
import { davinciAuthButtonLift, davinciBeamInnerSurface, davinciGlassSurface } from './glass-surface'

export interface DavinciGlassStatBlockProps {
  value: string
  label: string
  hint?: string
  className?: string
  /** Subtle beam animation on hover */
  beamOnHover?: boolean
}

/**
 * DaVinci glass stat tile for home / publisher right rails.
 * Value (OSS, 20+, AI…) + label + optional hint in glassmorphism surface.
 */
export function DavinciGlassStatBlock({
  value,
  label,
  hint,
  className,
  beamOnHover = true,
}: DavinciGlassStatBlockProps) {
  return (
    <BorderBeam
      disabled={!beamOnHover}
      duration="6s"
      className={cn(davinciGlassSurface, davinciAuthButtonLift, 'group min-w-0', className)}
      innerClassName={cn(davinciBeamInnerSurface, 'p-3 text-left')}
    >
      <div className="truncate text-xl font-bold tracking-tight text-[var(--davinci-beam)] tabular-nums sm:text-2xl">
        {value}
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug text-foreground">{label}</div>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </BorderBeam>
  )
}
