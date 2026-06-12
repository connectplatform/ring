'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SIDEBAR_ASIDE_COLLAPSE_THRESHOLD,
  SIDEBAR_ASIDE_DEFAULT,
  SIDEBAR_ASIDE_MAX,
  applySidebarCssVars,
  persistSidebarState,
  readSidebarStateFromStorage,
} from '@/lib/sidebar-pref'
import { useMediaQuery } from '@/hooks/use-media-query'

const SPRING = {
  stiffness: 420,
  damping: 30,
  mass: 1,
  restDistance: 0.4,
  restVelocity: 0.4,
  maxDuration: 800,
} as const

const KEYBOARD_STEP = 16

export interface UseSidebarResizeOptions {
  /** iPad overlay mode — aside open state does not change layout var */
  overlayMode?: boolean
}

export function useSidebarResize({ overlayMode = false }: UseSidebarResizeOptions = {}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const asideContentRef = useRef<HTMLDivElement>(null)
  const dragTriggerRef = useRef<HTMLDivElement>(null)
  const asideWRef = useRef(SIDEBAR_ASIDE_DEFAULT)
  const rafRef = useRef<number | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startW: SIDEBAR_ASIDE_DEFAULT })
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const setAsideWidth = useCallback((width: number, min = 0) => {
    const clamped = Math.min(SIDEBAR_ASIDE_MAX, Math.max(min, width))
    asideWRef.current = clamped
    if (!overlayMode) {
      applySidebarCssVars(clamped)
    }
    const content = asideContentRef.current
    if (content) {
      content.toggleAttribute('data-too-small', clamped > 0 && clamped < SIDEBAR_ASIDE_COLLAPSE_THRESHOLD)
    }
    return clamped
  }, [overlayMode])

  const setCollapsing = useCallback((value: boolean) => {
    const content = asideContentRef.current
    if (!content) return
    if (value) {
      content.dataset.collapsing = ''
    } else {
      delete content.dataset.collapsing
    }
  }, [])

  const cancelSpring = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setCollapsing(false)
  }, [setCollapsing])

  const commitState = useCallback(
    (asideW: number, isCollapsed: boolean) => {
      setCollapsed(isCollapsed)
      persistSidebarState({ asideW: isCollapsed ? 0 : asideW, collapsed: isCollapsed })
      if (!overlayMode) {
        applySidebarCssVars(isCollapsed ? 0 : asideW)
        document.documentElement.setAttribute('data-sidebar-anim', '')
        window.setTimeout(() => {
          document.documentElement.removeAttribute('data-sidebar-anim')
        }, 520)
      }
    },
    [overlayMode],
  )

  const snapCollapse = useCallback(() => {
    cancelSpring()
    if (prefersReducedMotion) {
      setAsideWidth(0)
      commitState(asideWRef.current, true)
      return
    }
    setCollapsing(true)
    let width = asideWRef.current
    let velocity = 0
    let lastTime: number | null = null
    const startTime = performance.now()

    const tick = (now: number) => {
      if (lastTime === null) lastTime = now
      const dt = Math.min((now - lastTime) / 1000, 0.064)
      lastTime = now
      const accel = (-SPRING.stiffness * (width - 0) - SPRING.damping * velocity) / SPRING.mass
      velocity += accel * dt
      width += velocity * dt
      setAsideWidth(width, 0)

      const settled = Math.abs(width - 0) < SPRING.restDistance && Math.abs(velocity) < SPRING.restVelocity
      const timedOut = now - startTime > SPRING.maxDuration
      if (!settled && !timedOut) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      rafRef.current = null
      setAsideWidth(0)
      setCollapsing(false)
      commitState(0, true)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [cancelSpring, commitState, prefersReducedMotion, setAsideWidth, setCollapsing])

  const expand = useCallback(
    (width = SIDEBAR_ASIDE_DEFAULT) => {
      cancelSpring()
      const target = Math.min(SIDEBAR_ASIDE_MAX, Math.max(SIDEBAR_ASIDE_COLLAPSE_THRESHOLD, width))
      setAsideWidth(target)
      commitState(target, false)
      if (overlayMode) setOverlayOpen(true)
    },
    [cancelSpring, commitState, overlayMode, setAsideWidth],
  )

  const toggleCollapse = useCallback(() => {
    if (collapsed || asideWRef.current < SIDEBAR_ASIDE_COLLAPSE_THRESHOLD) {
      expand()
    } else {
      snapCollapse()
    }
  }, [collapsed, expand, snapCollapse])

  const endDrag = useCallback(
    (pointerId: number) => {
      const trigger = dragTriggerRef.current
      if (!trigger || !dragRef.current.active) return
      dragRef.current.active = false
      trigger.releasePointerCapture(pointerId)
      document.body.style.removeProperty('user-select')
      document.body.style.removeProperty('cursor')

      const width = asideWRef.current
      if (width < SIDEBAR_ASIDE_COLLAPSE_THRESHOLD) {
        snapCollapse()
      } else {
        commitState(width, false)
      }
    },
    [commitState, snapCollapse],
  )

  useEffect(() => {
    const stored = readSidebarStateFromStorage()
    if (overlayMode) {
      setAsideWidth(0)
      setCollapsed(true)
      applySidebarCssVars(0)
      return
    }
    if (stored.collapsed) {
      setAsideWidth(0)
      setCollapsed(true)
    } else {
      setAsideWidth(stored.asideW || SIDEBAR_ASIDE_DEFAULT)
      setCollapsed(false)
    }
  }, [overlayMode, setAsideWidth])

  useEffect(() => {
    const trigger = dragTriggerRef.current
    if (!trigger || overlayMode) return

    const onPointerDown = (e: PointerEvent) => {
      cancelSpring()
      dragRef.current = { active: true, startX: e.clientX, startW: asideWRef.current }
      trigger.setPointerCapture(e.pointerId)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ew-resize'
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return
      const delta = e.clientX - dragRef.current.startX
      setAsideWidth(dragRef.current.startW + delta)
    }

    const onPointerUp = (e: PointerEvent) => endDrag(e.pointerId)
    const onDoubleClick = () => toggleCollapse()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== trigger) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setAsideWidth(asideWRef.current - KEYBOARD_STEP)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setAsideWidth(asideWRef.current + KEYBOARD_STEP)
      } else if (e.key === 'Home') {
        e.preventDefault()
        snapCollapse()
      } else if (e.key === 'End') {
        e.preventDefault()
        expand(SIDEBAR_ASIDE_MAX)
      }
    }

    trigger.addEventListener('pointerdown', onPointerDown)
    trigger.addEventListener('pointermove', onPointerMove)
    trigger.addEventListener('pointerup', onPointerUp)
    trigger.addEventListener('pointercancel', onPointerUp)
    trigger.addEventListener('dblclick', onDoubleClick)
    trigger.addEventListener('keydown', onKeyDown)

    return () => {
      trigger.removeEventListener('pointerdown', onPointerDown)
      trigger.removeEventListener('pointermove', onPointerMove)
      trigger.removeEventListener('pointerup', onPointerUp)
      trigger.removeEventListener('pointercancel', onPointerUp)
      trigger.removeEventListener('dblclick', onDoubleClick)
      trigger.removeEventListener('keydown', onKeyDown)
    }
  }, [cancelSpring, endDrag, expand, overlayMode, setAsideWidth, snapCollapse, toggleCollapse])

  return {
    gridRef,
    asideContentRef,
    dragTriggerRef,
    collapsed,
    overlayOpen,
    setOverlayOpen,
    expand,
    toggleCollapse,
    snapCollapse,
  }
}
