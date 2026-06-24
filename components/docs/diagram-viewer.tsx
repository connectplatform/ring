'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Moon, Sun, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'

const ZOOM_MIN = 50
const ZOOM_MAX = 200
const ZOOM_DEFAULT = 100

/** Above mobile bottom nav (`z-[9000]`) and avatar widget (`z-[8500]`). */
const DIAGRAM_FULLSCREEN_Z = 9200
const DIAGRAM_FULLSCREEN_CONTROLS_Z = 9210

type PanPoint = { x: number; y: number }

interface DragSession {
  pointerId: number
  originX: number
  originY: number
  panX: number
  panY: number
}

export interface DiagramViewerProps {
  title?: string
  children: React.ReactNode
  /** Shown when diagram has no visible title */
  diagramLabel?: string
  className?: string
}

function useDocumentTheme() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const toggle = useCallback(() => {
    toggleThemeWithTransition(setTheme, theme, resolvedTheme)
  }, [resolvedTheme, setTheme, theme])

  const isDark = mounted && resolvedTheme === 'dark'

  return { mounted, isDark, toggle }
}

interface DiagramZoomSliderProps {
  zoom: number
  onZoomChange: (value: number) => void
  id: string
  orientation: 'horizontal' | 'vertical'
  className?: string
  style?: React.CSSProperties
}

function DiagramZoomSlider({ zoom, onZoomChange, id, orientation, className, style }: DiagramZoomSliderProps) {
  const isVertical = orientation === 'vertical'

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg',
        isVertical ? 'flex-col py-5' : 'flex-row',
        className,
      )}
      style={style}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zoom</span>
      <input
        id={id}
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={5}
        value={zoom}
        onChange={(event) => onZoomChange(Number(event.target.value))}
        aria-valuemin={ZOOM_MIN}
        aria-valuemax={ZOOM_MAX}
        aria-valuenow={zoom}
        aria-label="Diagram zoom level"
        className={cn(
          'cursor-pointer accent-[var(--davinci-beam,hsl(var(--primary)))]',
          isVertical
            ? 'h-40 w-2 [writing-mode:vertical-lr] [direction:rtl]'
            : 'h-2 w-40 sm:w-52',
        )}
      />
      <span className="min-w-[3ch] text-center text-sm font-medium tabular-nums text-foreground">{zoom}%</span>
    </div>
  )
}

interface DiagramFullscreenOverlayProps {
  open: boolean
  onClose: () => void
  title?: string
  diagramLabel?: string
  children: React.ReactNode
}

function DiagramFullscreenOverlay({
  open,
  onClose,
  title,
  diagramLabel,
  children,
}: DiagramFullscreenOverlayProps) {
  const sliderId = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const { mounted, isDark, toggle } = useDocumentTheme()

  const endDrag = useCallback((pointerId: number) => {
    dragSessionRef.current = null
    setIsDragging(false)
    viewportRef.current?.releasePointerCapture(pointerId)
  }, [])

  const onViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return

      event.preventDefault()
      dragSessionRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      }
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [pan.x, pan.y],
  )

  const onViewportPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    event.preventDefault()
    setPan({
      x: session.panX + (event.clientX - session.originX),
      y: session.panY + (event.clientY - session.originY),
    })
  }, [])

  const onViewportPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      endDrag(event.pointerId)
    },
    [endDrag],
  )

  useEffect(() => {
    if (!open) {
      setZoom(ZOOM_DEFAULT)
      setPan({ x: 0, y: 0 })
      setIsDragging(false)
      dragSessionRef.current = null
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? diagramLabel ?? 'Diagram viewer'}
      className="fixed inset-0 flex flex-col bg-background"
      style={{ zIndex: DIAGRAM_FULLSCREEN_Z }}
    >
      {title ? (
        <p className="sr-only">{title}</p>
      ) : diagramLabel ? (
        <p className="sr-only">{diagramLabel}</p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onClose}
        aria-label="Close diagram viewer"
        className="fixed top-4 right-4 h-14 w-14 rounded-2xl border-2 shadow-lg"
        style={{ zIndex: DIAGRAM_FULLSCREEN_CONTROLS_Z }}
      >
        <X className="h-7 w-7" aria-hidden />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggle}
        aria-label="Toggle theme"
        className="fixed top-4 left-4 h-14 w-14 rounded-2xl border-2 shadow-lg md:top-auto md:left-auto md:bottom-6 md:right-6"
        style={{ zIndex: DIAGRAM_FULLSCREEN_CONTROLS_Z }}
      >
        {!mounted ? (
          <Sun className="h-7 w-7" aria-hidden />
        ) : isDark ? (
          <Moon className="h-7 w-7" aria-hidden />
        ) : (
          <Sun className="h-7 w-7" aria-hidden />
        )}
      </Button>

      <DiagramZoomSlider
        id={`${sliderId}-mobile`}
        zoom={zoom}
        onZoomChange={setZoom}
        orientation="horizontal"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden"
        style={{ zIndex: DIAGRAM_FULLSCREEN_CONTROLS_Z }}
      />

      <DiagramZoomSlider
        id={`${sliderId}-desktop`}
        zoom={zoom}
        onZoomChange={setZoom}
        orientation="vertical"
        className="fixed left-6 top-1/2 hidden -translate-y-1/2 md:flex"
        style={{ zIndex: DIAGRAM_FULLSCREEN_CONTROLS_Z }}
      />

      <div
        ref={viewportRef}
        role="application"
        aria-label="Diagram canvas — drag to pan, use zoom slider to scale"
        className={cn(
          'flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-28 pt-20 touch-none select-none md:pl-28 md:pr-12 md:pb-24 md:pt-12',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onLostPointerCapture={(event) => {
          if (dragSessionRef.current?.pointerId === event.pointerId) {
            endDrag(event.pointerId)
          }
        }}
      >
        <div
          className="min-w-0 [&_*]:select-none [&_svg]:pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 150ms ease-out',
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Wraps rendered diagrams with inline chrome + optional fullscreen viewer. */
export function DiagramViewer({ title, children, diagramLabel, className }: DiagramViewerProps) {
  const [fullscreen, setFullscreen] = useState(false)
  const label = title ?? diagramLabel ?? 'Diagram'

  return (
    <>
      <figure className={cn('my-6 w-full min-w-0', className)}>
        {title ? (
          <figcaption className="mb-2 font-semibold text-foreground">{title}</figcaption>
        ) : null}
        <div className="relative flex w-full min-h-[12rem] min-w-0 items-center justify-center overflow-x-auto rounded-lg border border-border bg-background p-4 md:p-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setFullscreen(true)}
            aria-label={`Open ${label} in fullscreen`}
            title="Zoom fullscreen"
            className="absolute right-3 top-3 z-10 h-10 w-10 rounded-xl border-2 bg-background/95 shadow-sm backdrop-blur-sm"
          >
            <Maximize2 className="h-5 w-5" aria-hidden />
          </Button>
          {children}
        </div>
      </figure>

      <DiagramFullscreenOverlay
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title={title}
        diagramLabel={diagramLabel}
      >
        <div className="w-full min-w-[min(100vw,64rem)] max-w-none [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-none [&_svg]:w-full">
          {children}
        </div>
      </DiagramFullscreenOverlay>
    </>
  )
}
