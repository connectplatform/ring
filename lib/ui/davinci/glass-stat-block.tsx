'use client'

import { cn } from '@/lib/utils'
import { BorderBeam } from './border-beam'
import { davinciAuthButtonLift, davinciBeamInnerSurface, davinciGlassSurface } from './glass-surface'

export interface DavinciGlassStatBlockProps {
  value: string
  label: string
  hint: string
  className?: string
  /** Subtle beam animation on hover */
  beamOnHover?: boolean
}

/**
 * DaVinci glass stat tile for home / publisher right rails.
 * Value (OSS, 20+, AI…) + label + hint in glassmorphism surface.
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
      className={cn(davinciGlassSurface, davinciAuthButtonLift, 'group', className)}
      innerClassName={cn(davinciBeamInnerSurface, 'p-4 text-left')}
    >
      <div className="text-2xl font-bold tracking-tight text-[var(--davinci-beam)]">{value}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </BorderBeam>
  )
}
