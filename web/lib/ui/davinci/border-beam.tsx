'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  innerClassName?: string
  /** Beam rotation period, e.g. "4s" */
  duration?: string
  /** Disable beam (static glass only) */
  disabled?: boolean
  /**
   * Show the traveling gradient on the border ring only
   * (no animated fill behind transparent content).
   */
  borderOnly?: boolean
}

/**
 * Grok Build–inspired traveling conic-gradient border overlay.
 * Outer glow ring + opaque inner surface masks the gradient center.
 * Use `borderOnly` when the inner surface is transparent.
 */
export function BorderBeam({
  children,
  className,
  innerClassName,
  duration = '4s',
  disabled = false,
  borderOnly = false,
  style,
  ...props
}: BorderBeamProps) {
  return (
    <div
      className={cn('relative min-w-0 rounded-[inherit]', className)}
      style={
        {
          '--davinci-beam-duration': duration,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {!disabled && (
        <div
          aria-hidden
          className={cn(
            borderOnly
              ? 'davinci-border-beam-glow-ring animate-davinci-border-beam'
              : 'davinci-border-beam-glow animate-davinci-border-beam',
            // Explicit radius — inherit often fails on absolute beam overlays
            'pointer-events-none absolute -inset-px rounded-[15px]',
          )}
        />
      )}
      <div className={cn('relative rounded-[15px]', innerClassName)}>{children}</div>
    </div>
  )
}
