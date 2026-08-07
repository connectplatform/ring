'use client'

/** Duration aligned with globals.css theme transition rules. */
export const RING_THEME_TRANSITION_MS = 320

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Wraps a theme DOM update with View Transitions API or a brief CSS color transition. */
export function applyRingThemeTransition(action: () => void): void {
  if (typeof document === 'undefined') {
    action()
    return
  }

  if (prefersReducedMotion()) {
    action()
    return
  }

  const root = document.documentElement
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> }
  }

  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => {
      action()
    })
    return
  }

  root.classList.add('ring-theme-transition')
  action()
  window.setTimeout(() => {
    root.classList.remove('ring-theme-transition')
  }, RING_THEME_TRANSITION_MS)
}

export function setThemeWithTransition(
  setTheme: (theme: string) => void,
  next: string,
): void {
  applyRingThemeTransition(() => setTheme(next))
}

/** Toggle light/dark based on effective appearance (respects system via resolvedTheme). */
export function toggleThemeWithTransition(
  setTheme: (theme: string) => void,
  theme: string | undefined,
  resolvedTheme: string | undefined,
): void {
  const active = theme === 'system' ? resolvedTheme : theme
  setThemeWithTransition(setTheme, active === 'dark' ? 'light' : 'dark')
}
