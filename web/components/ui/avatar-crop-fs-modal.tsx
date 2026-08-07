'use client'

/**
 * Absorbed round avatar cropper (react-easy-crop–class behaviour, no dependency):
 * fixed 1:1 crop window, round mask, pan + pinch/zoom, export square JPEG/WebP Blob.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { FsModal } from '@/components/ui/fs-modal'
import { cn } from '@/lib/utils'

export type AvatarCropPoint = { x: number; y: number }

export type AvatarCropAreaPixels = {
  x: number
  y: number
  width: number
  height: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const OUTPUT_SIZE = 512

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Compute natural-pixel crop rect for a centered square window over a transformed image. */
export function getAvatarCropAreaPixels(
  mediaWidth: number,
  mediaHeight: number,
  crop: AvatarCropPoint,
  zoom: number,
  cropSize: number,
): AvatarCropAreaPixels {
  const mediaRatio = mediaWidth / mediaHeight
  // Contained media size at zoom=1 (object-fit: contain into cropSize²)
  let baseW: number
  let baseH: number
  if (mediaRatio > 1) {
    baseW = cropSize
    baseH = cropSize / mediaRatio
  } else {
    baseH = cropSize
    baseW = cropSize * mediaRatio
  }

  const scaledW = baseW * zoom
  const scaledH = baseH * zoom

  // Image top-left in crop-container coords (container origin = top-left of crop square)
  const imgLeft = cropSize / 2 - scaledW / 2 + crop.x
  const imgTop = cropSize / 2 - scaledH / 2 + crop.y

  // Crop window is the full container [0, cropSize]
  const scaleX = mediaWidth / scaledW
  const scaleY = mediaHeight / scaledH

  const x = clamp((-imgLeft) * scaleX, 0, mediaWidth)
  const y = clamp((-imgTop) * scaleY, 0, mediaHeight)
  const width = clamp(cropSize * scaleX, 1, mediaWidth - x)
  const height = clamp(cropSize * scaleY, 1, mediaHeight - y)

  return { x, y, width, height }
}

export async function exportAvatarCropBlob(
  imageSrc: string,
  area: AvatarCropAreaPixels,
  options?: { mimeType?: 'image/webp' | 'image/jpeg'; quality?: number; size?: number },
): Promise<Blob> {
  const size = options?.size ?? OUTPUT_SIZE
  const quality = options?.quality ?? 0.92

  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    size,
    size,
  )

  const preferWebp = options?.mimeType === 'image/webp' || options?.mimeType == null
  if (preferWebp) {
    const webp = await canvasToBlob(canvas, 'image/webp', quality)
    if (webp && webp.size > 0) return webp
  }
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (!jpeg) throw new Error('Failed to encode crop')
  return jpeg
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
}

type RoundCropStageProps = {
  imageSrc: string
  className?: string
  onCropReady: (area: AvatarCropAreaPixels) => void
}

function RoundCropStage({ imageSrc, className, onCropReady }: RoundCropStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cropSize, setCropSize] = useState(280)
  const [media, setMedia] = useState<{ w: number; h: number } | null>(null)
  const [crop, setCrop] = useState<AvatarCropPoint>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      setCropSize(Math.max(180, Math.min(w, 360)))
    })
    ro.observe(el)
    setCropSize(Math.max(180, Math.min(el.clientWidth, 360)))
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadImage(imageSrc).then((img) => {
      if (cancelled) return
      setMedia({ w: img.naturalWidth, h: img.naturalHeight })
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    })
    return () => {
      cancelled = true
    }
  }, [imageSrc])

  const emitCrop = useCallback(() => {
    if (!media) return
    onCropReady(getAvatarCropAreaPixels(media.w, media.h, crop, zoom, cropSize))
  }, [media, crop, zoom, cropSize, onCropReady])

  useEffect(() => {
    emitCrop()
  }, [emitCrop])

  const mediaRatio = media ? media.w / media.h : 1
  let baseW = cropSize
  let baseH = cropSize
  if (mediaRatio > 1) {
    baseW = cropSize
    baseH = cropSize / mediaRatio
  } else {
    baseH = cropSize
    baseW = cropSize * mediaRatio
  }
  const scaledW = baseW * zoom
  const scaledH = baseH * zoom

  const constrainCrop = useCallback(
    (next: AvatarCropPoint, z: number): AvatarCropPoint => {
      if (!media) return next
      const ratio = media.w / media.h
      let bW: number
      let bH: number
      if (ratio > 1) {
        bW = cropSize
        bH = cropSize / ratio
      } else {
        bH = cropSize
        bW = cropSize * ratio
      }
      const sW = bW * z
      const sH = bH * z
      const mx = Math.max(0, (sW - cropSize) / 2)
      const my = Math.max(0, (sH - cropSize) / 2)
      return { x: clamp(next.x, -mx, mx), y: clamp(next.y, -my, my) }
    },
    [media, cropSize],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && (e as unknown as { touches?: TouchList }).touches) {
      // multi-touch handled on touch events
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: crop.x,
      originY: crop.y,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const next = constrainCrop(
      {
        x: d.originX + (e.clientX - d.startX),
        y: d.originY + (e.clientY - d.startY),
      },
      zoom,
    )
    setCrop(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { distance: dist, zoom }
      dragRef.current = null
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const nextZoom = clamp(
        pinchRef.current.zoom * (dist / pinchRef.current.distance),
        MIN_ZOOM,
        MAX_ZOOM,
      )
      setZoom(nextZoom)
      setCrop((c) => constrainCrop(c, nextZoom))
    }
  }

  const onTouchEnd = () => {
    if (!pinchRef.current) return
    pinchRef.current = null
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.002
    const nextZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM)
    setZoom(nextZoom)
    setCrop((c) => constrainCrop(c, nextZoom))
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div ref={containerRef} className="mx-auto w-full max-w-[360px]">
        <div
          className="relative mx-auto touch-none select-none overflow-hidden rounded-full bg-muted"
          style={{ width: cropSize, height: cropSize }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          role="presentation"
        >
          {media ? (
            // eslint-disable-next-line @next/next/no-img-element -- crop stage needs raw transform control
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: scaledW,
                height: scaledH,
                transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
              }}
            />
          ) : null}
          {/* Soft ring so the round crop edge is visible */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80 ring-offset-2 ring-offset-black/40"
            aria-hidden
          />
        </div>
      </div>

      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Zoom</span>
          <span>{zoom.toFixed(1)}×</span>
        </div>
        <Slider
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={[zoom]}
          onValueChange={([z]) => {
            const nextZoom = clamp(z ?? 1, MIN_ZOOM, MAX_ZOOM)
            setZoom(nextZoom)
            setCrop((c) => constrainCrop(c, nextZoom))
          }}
        />
        <p className="text-xs text-muted-foreground">
          Drag to reposition. Pinch or scroll to zoom.
        </p>
      </div>
    </div>
  )
}

export type AvatarCropFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string | null
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (file: File) => void | Promise<void>
}

export function AvatarCropFsModal({
  open,
  onOpenChange,
  imageSrc,
  title = 'Crop avatar',
  confirmLabel = 'Use photo',
  cancelLabel = 'Cancel',
  onConfirm,
}: AvatarCropFsModalProps) {
  const [area, setArea] = useState<AvatarCropAreaPixels | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setArea(null)
      setError(null)
      setBusy(false)
    }
  }, [open])

  const handleConfirm = async () => {
    if (!imageSrc || !area) return
    setBusy(true)
    setError(null)
    try {
      const blob = await exportAvatarCropBlob(imageSrc, area)
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const file = new File([blob], `avatar.${ext}`, { type: blob.type })
      await onConfirm(file)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crop failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Adjust the circle, then confirm."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button type="button" disabled={busy || !area || !imageSrc} onClick={() => void handleConfirm()}>
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      }
    >
      {imageSrc ? (
        <RoundCropStage imageSrc={imageSrc} onCropReady={setArea} />
      ) : (
        <p className="text-sm text-muted-foreground">No image selected.</p>
      )}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </FsModal>
  )
}
