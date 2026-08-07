'use client'

/**
 * Fullscreen File Cabinet / editor image viewer.
 * Chrome adapted from private DiagramFullscreenOverlay (not exported).
 * WebKit: show controls on pointer/touch/mousemove (not hover-only); honor prefers-reduced-motion.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Clapperboard, Download, Moon, Sparkles, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toggleThemeWithTransition } from '@/lib/theme/ring-theme-transition'
import { cabinetDownloadUrl } from '@/features/file-cabinet/media-urls'
import { FILE_CABINET_DOWNLOAD_PATH } from '@/features/file-cabinet/constants'

const ZOOM_MIN = 50
const ZOOM_MAX = 200
const ZOOM_DEFAULT = 100
const VIEWER_Z = 9200
const CONTROLS_Z = 9210
const AUTOHIDE_MS = 1000

type PanPoint = { x: number; y: number }

interface DragSession {
  pointerId: number
  originX: number
  originY: number
  panX: number
  panY: number
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

function ZoomSlider({
  zoom,
  onZoomChange,
  id,
  orientation,
  className,
  style,
  visible,
}: {
  zoom: number
  onZoomChange: (value: number) => void
  id: string
  orientation: 'horizontal' | 'vertical'
  className?: string
  style?: React.CSSProperties
  visible: boolean
}) {
  const isVertical = orientation === 'vertical'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg transition-opacity duration-200',
        isVertical ? 'flex-col py-5' : 'flex-row',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
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
        aria-label="Image zoom level"
        className={cn(
          'cursor-pointer accent-[var(--davinci-beam,hsl(var(--primary)))]',
          isVertical
            ? 'h-40 w-2 [writing-mode:vertical-lr] [direction:rtl]'
            : 'h-2 w-40 sm:w-52',
        )}
      />
      <span className="min-w-[3ch] text-center text-sm font-medium tabular-nums text-foreground">
        {zoom}%
      </span>
    </div>
  )
}

export type FileCabinetImageViewerProps = {
  open: boolean
  onClose: () => void
  /** Cabinet node id — builds ACL download URL */
  nodeId?: string
  /** Direct image src (editor TipTap / external) */
  src?: string
  title?: string
  alt?: string
  onEnhance: () => void
  onEnlive: () => void
  showDownload?: boolean
  /** When false, hide Enhance/Enlive (e.g. shared trustee view). Default true. */
  allowGenerate?: boolean
}

export function FileCabinetImageViewer({
  open,
  onClose,
  nodeId,
  src,
  title,
  alt,
  onEnhance,
  onEnlive,
  showDownload = true,
  allowGenerate = true,
}: FileCabinetImageViewerProps) {
  const t = useTranslations('modules.fileCabinet')
  const sliderId = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [pan, setPan] = useState<PanPoint>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [lightBg, setLightBg] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const { mounted, isDark, toggle } = useDocumentTheme()

  const primarySrc =
    src ||
    (nodeId
      ? cabinetDownloadUrl(nodeId, { inline: true, variant: 'original_webp' })
      : null)
  const fallbackSrc = nodeId ? cabinetDownloadUrl(nodeId, { inline: true }) : src || null

  useEffect(() => {
    if (!open) {
      setZoom(ZOOM_DEFAULT)
      setPan({ x: 0, y: 0 })
      setIsDragging(false)
      setUsedFallback(false)
      setImgSrc(null)
      dragSessionRef.current = null
      return
    }
    setImgSrc(primarySrc)
    setUsedFallback(false)
    setControlsVisible(true)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [onClose, open, primarySrc])

  const bumpControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, AUTOHIDE_MS)
  }, [])

  useEffect(() => {
    if (!open) return
    bumpControls()
  }, [bumpControls, open])

  const endDrag = useCallback((pointerId: number) => {
    dragSessionRef.current = null
    setIsDragging(false)
    viewportRef.current?.releasePointerCapture(pointerId)
  }, [])

  const onViewportPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      bumpControls()
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
    [bumpControls, pan.x, pan.y],
  )

  const onViewportPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      bumpControls()
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      event.preventDefault()
      setPan({
        x: session.panX + (event.clientX - session.originX),
        y: session.panY + (event.clientY - session.originY),
      })
    },
    [bumpControls],
  )

  const onViewportPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      bumpControls()
      const session = dragSessionRef.current
      if (!session || session.pointerId !== event.pointerId) return
      endDrag(event.pointerId)
    },
    [bumpControls, endDrag],
  )

  if (!open || typeof document === 'undefined') return null

  const downloadHref =
    nodeId != null
      ? `${FILE_CABINET_DOWNLOAD_PATH}?nodeId=${encodeURIComponent(nodeId)}`
      : src || undefined

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || alt || t('imageViewerTitle')}
      className={cn(
        'fixed inset-0 flex flex-col',
        lightBg ? 'bg-white' : 'bg-background',
      )}
      style={{ zIndex: VIEWER_Z }}
      onPointerMove={bumpControls}
      onTouchStart={bumpControls}
      onMouseMove={bumpControls}
    >
      {title ? <p className="sr-only">{title}</p> : null}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onClose}
        aria-label={t('closeViewer')}
        className={cn(
          'fixed top-4 right-4 h-14 w-14 rounded-2xl border-2 shadow-lg transition-opacity duration-200',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ zIndex: CONTROLS_Z }}
      >
        <X className="h-7 w-7" aria-hidden />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggle}
        aria-label="Toggle theme"
        className={cn(
          'fixed top-4 left-4 h-14 w-14 rounded-2xl border-2 shadow-lg transition-opacity duration-200 md:top-auto md:left-auto md:bottom-6 md:right-6',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ zIndex: CONTROLS_Z }}
      >
        {!mounted ? (
          <Sun className="h-7 w-7" aria-hidden />
        ) : isDark ? (
          <Moon className="h-7 w-7" aria-hidden />
        ) : (
          <Sun className="h-7 w-7" aria-hidden />
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => setLightBg((v) => !v)}
        className={cn(
          'fixed top-4 left-20 h-14 rounded-2xl border-2 px-4 shadow-lg transition-opacity duration-200 md:top-auto md:bottom-6 md:left-auto md:right-24',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ zIndex: CONTROLS_Z }}
      >
        {t(lightBg ? 'bgDark' : 'bgLight')}
      </Button>

      <div
        className={cn(
          'fixed bottom-6 left-1/2 z-[9210] flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 transition-opacity duration-200',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ zIndex: CONTROLS_Z }}
      >
        {allowGenerate ? (
          <>
            <Button
              type="button"
              size="lg"
              className="rounded-2xl shadow-lg"
              onClick={() => onEnhance()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t('enhance')}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="rounded-2xl shadow-lg"
              onClick={() => onEnlive()}
            >
              <Clapperboard className="mr-2 h-4 w-4" />
              {t('enlive')}
            </Button>
          </>
        ) : null}
        {showDownload && downloadHref ? (
          <Button type="button" size="lg" variant="outline" className="rounded-2xl shadow-lg" asChild>
            <a href={downloadHref} download={title || 'image'}>
              <Download className="mr-2 h-4 w-4" />
              {t('download')}
            </a>
          </Button>
        ) : null}
      </div>

      <ZoomSlider
        id={`${sliderId}-mobile`}
        zoom={zoom}
        onZoomChange={setZoom}
        orientation="horizontal"
        visible={controlsVisible}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 md:hidden"
        style={{ zIndex: CONTROLS_Z }}
      />
      <ZoomSlider
        id={`${sliderId}-desktop`}
        zoom={zoom}
        onZoomChange={setZoom}
        orientation="vertical"
        visible={controlsVisible}
        className="fixed left-6 top-1/2 hidden -translate-y-1/2 md:flex"
        style={{ zIndex: CONTROLS_Z }}
      />

      <div
        ref={viewportRef}
        role="application"
        aria-label="Image canvas — drag to pan, use zoom slider to scale"
        className={cn(
          'flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-32 pt-20 touch-none select-none md:pl-28 md:pr-12 md:pb-28 md:pt-12',
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
          className="min-w-0 max-h-[100dvh] max-w-[100dvw]"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 150ms ease-out',
          }}
        >
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={alt || title || ''}
              draggable={false}
              className="max-h-[100dvh] max-w-[100dvw] object-contain"
              onError={() => {
                if (!usedFallback && fallbackSrc && fallbackSrc !== imgSrc) {
                  setUsedFallback(true)
                  setImgSrc(fallbackSrc)
                }
              }}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
