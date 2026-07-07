'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RingCenterPaneOverlayProps {
  open: boolean
  children: ReactNode
  className?: string
  ariaLabel?: string
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
}: RingCenterPaneOverlayProps) {
  // Holds the DOM node to portal into
  const [panel, setPanel] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // If overlay not open, clear panel reference
    if (!open) {
      setPanel(null)
      return
    }
    // Find all content panels
    const panels = document.querySelectorAll('.ring-content-panel')
    // Use the last content panel in case of nesting, else fallback to the app frame
    const target =
      panels.length > 0
        ? (panels[panels.length - 1] as HTMLElement)
        : (document.querySelector('.ring-app-frame') as HTMLElement | null)
    setPanel(target)
    // TODO: Use React 19's useSyncExternalStore if panel DOM mutation subscriptions are a concern
  }, [open])

  useEffect(() => {
    // When overlay is open, lock overflow in target panel to prevent background scroll
    if (!open || !panel) return
    const prevOverflow = panel.style.overflow
    panel.style.overflow = 'hidden'
    // Restore overflow when unmounting or closing
    return () => {
      panel.style.overflow = prevOverflow
    }
    // TODO: If React 19 supports layout effects with DOM, consider useInsertionEffect here for earlier style lock
  }, [open, panel])

  // Don't render if not open or if portal target unavailable
  if (!open || !panel) return null

  return createPortal(
    <motion.div
      className={cn(
        'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-[inherit]',
        'davinci-panel-surface',
        className,
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      // Accessibility props for dialog overlay
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-modal="true"
    >
      {children}
    </motion.div>,
    panel,
  )
  // TODO: Use React 19's createPortal from 'react' instead of 'react-dom' once stable
}
