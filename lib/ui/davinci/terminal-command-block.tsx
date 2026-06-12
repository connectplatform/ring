'use client'

import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BorderBeam } from './border-beam'
import { davinciBeamInnerSurface, davinciTerminalSurface } from './glass-surface'

export interface TerminalCommandBlockProps {
  command: string
  className?: string
  duration?: string
  copyLabel?: string
  /** Accent border beam — use sparingly (default off on homepage) */
  beam?: boolean
}

export function TerminalCommandBlock({
  command,
  className,
  duration = '5s',
  copyLabel = 'Copy command',
  beam = false,
}: TerminalCommandBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy command:', err)
    }
  }, [command])

  const inner = (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copyLabel}
      className={cn(
        'grid h-full w-full min-w-0 cursor-pointer',
        'grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-3',
        'px-4 py-3 font-mono text-left text-xs sm:text-sm',
        'text-foreground outline-none',
        'hover:bg-muted/15 transition-colors'
      )}
    >
      <code className="min-w-0 overflow-x-auto whitespace-nowrap leading-5 [scrollbar-width:none]">
        {command}
      </code>
      <span className="flex shrink-0 items-center justify-center text-muted-foreground">
        {copied ? (
          <Check className="size-4 text-[var(--davinci-beam)]" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </span>
    </button>
  )

  if (beam) {
    return (
      <BorderBeam
        className={cn('rounded-xl w-full', className)}
        innerClassName={cn(davinciBeamInnerSurface, 'overflow-hidden border-0')}
        duration={duration}
      >
        {inner}
      </BorderBeam>
    )
  }

  return (
    <div className={cn(davinciTerminalSurface, 'w-full overflow-hidden', className)}>
      {inner}
    </div>
  )
}
