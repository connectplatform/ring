'use client'

import { cn } from '@/lib/utils'

/** Soft drifting orbs behind hero — DaVinci depth without border beams */
export function HeroAmbient({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-br from-primary/[0.06] via-transparent to-blue-500/[0.04]',
        className,
      )}
    >
      <div
        className="davinci-ambient-orb -left-[20%] top-[5%] h-[55vmin] w-[55vmin] max-h-80 max-w-80 bg-gradient-to-br from-primary/25 to-[var(--davinci-beam)]/20 md:-left-16 md:top-8 md:h-48 md:w-48"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="davinci-ambient-orb -right-[15%] bottom-[8%] h-[60vmin] w-[60vmin] max-h-96 max-w-96 bg-gradient-to-br from-blue-500/15 to-purple-500/15 md:-right-12 md:bottom-16 md:h-56 md:w-56"
        style={{ animationDelay: '-6s' }}
      />
    </div>
  )
}
