'use client'

/**
 * iOS-style roller (wheel) picker column — CSS scroll-snap physics.
 *
 * WebKit-safe by design (react-19-webkit-compatibility lens): native momentum
 * scrolling with `scroll-snap-type: y mandatory` + `scroll-snap-align: center`
 * replicates the early-iOS wheel feel without JS touch math. The selected
 * index is the debounced rounded scroll offset — works identically for touch,
 * trackpad, and mouse wheels.
 *
 * Hidden scrollbar, center highlight band, and top/bottom fade masks complete
 * the wheel illusion. Column order (day/month/year) is the caller's concern.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface RollerPickerProps {
  items: string[]
  /** Selected item index. */
  value: number
  onChange: (index: number) => void
  ariaLabel: string
  /** Item height in px (default 40). */
  itemHeight?: number
  /** Visible rows — odd number (default 5). */
  visibleCount?: number
  className?: string
}

const EMIT_DEBOUNCE_MS = 120

export function RollerPicker({
  items,
  value,
  onChange,
  ariaLabel,
  itemHeight = 40,
  visibleCount = 5,
  className,
}: RollerPickerProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const lastEmittedRef = useRef(value)
  const [activeIndex, setActiveIndex] = useState(value)

  const pad = ((visibleCount - 1) / 2) * itemHeight
  const viewportHeight = visibleCount * itemHeight

  // Sync to external `value` (mount + programmatic changes like month clamps).
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const target = value * itemHeight
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: 'smooth' })
    }
    setActiveIndex(value)
    lastEmittedRef.current = value
  }, [value, itemHeight])

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    },
    [],
  )

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const idx = Math.min(
      items.length - 1,
      Math.max(0, Math.round(el.scrollTop / itemHeight)),
    )
    setActiveIndex(idx)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (idx !== lastEmittedRef.current) {
        lastEmittedRef.current = idx
        onChange(idx)
      }
    }, EMIT_DEBOUNCE_MS)
  }, [items.length, itemHeight, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const next =
        e.key === 'ArrowUp'
          ? Math.max(0, lastEmittedRef.current - 1)
          : Math.min(items.length - 1, lastEmittedRef.current + 1)
      if (next === lastEmittedRef.current) return
      lastEmittedRef.current = next
      setActiveIndex(next)
      listRef.current?.scrollTo({ top: next * itemHeight, behavior: 'smooth' })
      onChange(next)
    },
    [items.length, itemHeight, onChange],
  )

  return (
    <div className={cn('relative', className)} aria-label={ariaLabel}>
      {/* Center highlight band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-lg border border-border/60 bg-muted/40"
        style={{ top: pad, height: itemHeight }}
      />
      {/* Top/bottom fade masks (wheel illusion) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background via-background/70 to-transparent"
        style={{ height: pad }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/70 to-transparent"
        style={{ height: pad }}
      />

      <div
        ref={listRef}
        role="spinbutton"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={items.length - 1}
        aria-valuenow={activeIndex}
        aria-valuetext={items[activeIndex]}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className={cn(
          'snap-y snap-mandatory overflow-y-auto overscroll-contain outline-none',
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          'focus-visible:ring-1 focus-visible:ring-ring',
          className,
        )}
        style={{
          height: viewportHeight,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div aria-hidden style={{ height: pad }} />
        {items.map((item, idx) => (
          <div
            key={`${item}-${idx}`}
            aria-hidden={idx !== activeIndex}
            className={cn(
              'flex snap-center items-center justify-center select-none',
              'transition-all duration-150',
              idx === activeIndex
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground/70 text-sm',
            )}
            style={{ height: itemHeight }}
          >
            {item}
          </div>
        ))}
        <div aria-hidden style={{ height: pad }} />
      </div>
    </div>
  )
}
