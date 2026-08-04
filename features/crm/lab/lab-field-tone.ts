import { cn } from '@/lib/utils'

export type LabFieldTone = 'required' | 'recommended' | 'ok' | 'neutral'

/** Status chrome for Order Lab form fields (Phase 3 — light touch). */
export function labFieldClassName(tone: LabFieldTone, className?: string): string {
  return cn(
    className,
    tone === 'required' && 'border-red-500/40 bg-red-500/10',
    tone === 'recommended' && 'border-orange-500/40 bg-orange-500/10',
    tone === 'ok' &&
      'border-[color-mix(in_oklch,var(--davinci-beam)_40%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_6%,transparent)]',
  )
}

export function toneForEmpty(opts: {
  empty: boolean
  required?: boolean
  recommended?: boolean
}): LabFieldTone {
  if (!opts.empty) return 'ok'
  if (opts.required) return 'required'
  if (opts.recommended) return 'recommended'
  return 'neutral'
}
