'use client'

import React, { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type QuickSearchFilterProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** When true, focus the input on mount (opens mobile keyboard). */
  autoFocus?: boolean
  /** Re-focus when this key changes (e.g. panel open). */
  focusKey?: string | number | boolean
  className?: string
  inputClassName?: string
  'aria-label'?: string
}

/**
 * Compact quick-search filter — same pattern as docs navigation panel
 * (Search icon + Input). Used to filter in-panel lists without a submit.
 */
export function QuickSearchFilter({
  value,
  onChange,
  placeholder = 'Filter…',
  autoFocus = false,
  focusKey,
  className,
  inputClassName,
  'aria-label': ariaLabel,
}: QuickSearchFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!autoFocus) return
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [autoFocus, focusKey])

  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn('h-8 pl-8 text-sm', inputClassName)}
      />
    </div>
  )
}
