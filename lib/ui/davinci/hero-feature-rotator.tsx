'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { davinciPanelSurface } from './glass-surface'

export interface HeroFeatureRotatorProps {
  features: string[]
  className?: string
  intervalMs?: number
}

/**
 * Blur crossfade rotator with dot indicators — no border beam.
 */
export function HeroFeatureRotator({
  features,
  className,
  intervalMs = 4500,
}: HeroFeatureRotatorProps) {
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (reducedMotion || features.length <= 1) return
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % features.length),
      intervalMs
    )
    return () => window.clearInterval(id)
  }, [features.length, intervalMs, reducedMotion])

  if (!features.length) return null

  const activeIndex = reducedMotion ? 0 : index

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      <div
        className={cn(
          davinciPanelSurface,
          'relative min-h-[3.5rem] overflow-hidden px-5 py-4'
        )}
      >
        {reducedMotion ? (
          <p className="text-center text-sm sm:text-base text-muted-foreground leading-relaxed">
            {features[0]}
          </p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={activeIndex}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              className="text-center text-sm sm:text-base text-muted-foreground leading-relaxed"
            >
              {features[activeIndex]}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
      {!reducedMotion && features.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {features.map((_, i) => (
            <span
              key={i}
              className="davinci-feature-dot"
              data-active={i === activeIndex ? 'true' : 'false'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
