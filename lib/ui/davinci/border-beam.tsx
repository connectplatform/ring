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
}

/**
 * Grok Build–inspired traveling conic-gradient border overlay.
 * Outer glow ring + opaque inner surface masks the gradient center.
 */
export function BorderBeam({
  children,
  className,
  innerClassName,
  duration = '4s',
  disabled = false,
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
            'davinci-border-beam-glow animate-davinci-border-beam',
            'pointer-events-none absolute -inset-px rounded-[inherit]'
          )}
        />
      )}
      <div className={cn('relative rounded-[inherit]', innerClassName)}>{children}</div>
    </div>
  )
}
