'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RingCenterPaneOverlayProps {
  open: boolean
  children: ReactNode
  className?: string
  ariaLabel?: string
  /** Escape / programmatic close — parent owns open state */
  onClose?: () => void
}

/**
 * Overlays the Lab01 center content panel — not the full viewport.
 * Portals into `.ring-content-panel` so left nav and right rail stay visible.
 */
export function RingCenterPaneOverlay({
  open,
  children,
  className,
  ariaLabel,
  onClose,
}: RingCenterPaneOverlayProps) {
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const panels = document.querySelectorAll('.ring-content-panel')
    const target =
      panels.length > 0
        ? (panels[panels.length - 1] as HTMLElement)
        : (document.querySelector('.ring-app-frame') as HTMLElement | null)
    setPanel(target)

    return () => {
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open || !panel) return
    const prevOverflow = panel.style.overflow
    panel.style.overflow = 'hidden'
    return () => {
      panel.style.overflow = prevOverflow
    }
  }, [open, panel])

  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!panel) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="ring-center-pane-overlay"
          className={cn(
            'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-[inherit]',
            className,
          )}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          data-modal="true"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-background/40 backdrop-blur-[2px]"
            aria-hidden
          />
          <div
            className={cn(
              'relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden',
              'davinci-panel-surface',
            )}
          >
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    panel,
  )
}
