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
  const [panel, setPanel] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      setPanel(null)
      return
    }
    const panels = document.querySelectorAll('.ring-content-panel')
    const target =
      panels.length > 0
        ? (panels[panels.length - 1] as HTMLElement)
        : (document.querySelector('.ring-app-frame') as HTMLElement | null)
    setPanel(target)
  }, [open])

  useEffect(() => {
    if (!open || !panel) return
    const prevOverflow = panel.style.overflow
    panel.style.overflow = 'hidden'
    return () => {
      panel.style.overflow = prevOverflow
    }
  }, [open, panel])

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
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-modal="true"
    >
      {children}
    </motion.div>,
    panel,
  )
}
