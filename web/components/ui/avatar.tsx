'use client'

import React, { useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Camera, Eye, Upload } from 'lucide-react'
import { AvatarCropFsModal } from '@/components/ui/avatar-crop-fs-modal'
import { AvatarViewFsModal } from '@/components/ui/avatar-view-fs-modal'
import { AvatarCameraCaptureFsModal } from '@/components/ui/avatar-camera-capture-fs-modal'

export interface AvatarProps {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  fallback?: string
  className?: string
  onClick?: () => void
  /**
   * When false (default), display-only — no camera/upload icons, no crop editor.
   * Floating profile chrome must leave this unset/false.
   */
  editable?: boolean
  /** Called with the final cropped (or raw) image file. Required for editable upload. */
  onUpload?: (file: File) => Promise<void> | void
  uploading?: boolean
  /** Show camera control when editable. Default true. */
  showCamera?: boolean
  /** Show gallery/upload control when editable. Default true. */
  showUpload?: boolean
  /**
   * Open absorbed round crop editor (FsModal) before calling onUpload.
   * Default true when editable.
   */
  enableCrop?: boolean
  cropTitle?: string
  cropConfirmLabel?: string
  cropCancelLabel?: string
  /**
   * When editable, clicking the avatar opens the image viewer (FsModal)
   * instead of immediately browsing files. Default true.
   */
  viewOnClick?: boolean
}

interface AvatarImageProps {
  src: string
  alt?: string
  className?: string
}

interface AvatarFallbackProps {
  children: React.ReactNode
  className?: string
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * Avatar — profile picture with optional edit controls.
 * Editable: click opens viewer; Camera uses getUserMedia; Upload opens gallery.
 */
export function Avatar({
  src,
  alt = '',
  size = 'md',
  fallback,
  className,
  onClick,
  editable = false,
  onUpload,
  uploading = false,
  showCamera = true,
  showUpload = true,
  enableCrop = true,
  cropTitle,
  cropConfirmLabel,
  cropCancelLabel,
  viewOnClick = true,
}: AvatarProps) {
  const [dragOver, setDragOver] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const resolvedSrc = src && !imageFailed ? src : null

  const canEdit = editable && Boolean(onUpload) && !uploading
  const cameraEnabled = canEdit && showCamera
  const uploadEnabled = canEdit && showUpload
  const cropEnabled = canEdit && enableCrop
  const openViewerOnClick = canEdit && viewOnClick

  React.useEffect(() => {
    setImageFailed(false)
  }, [src])

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-16 w-16 text-base',
    xl: 'h-24 w-24 text-lg',
    '2xl': 'h-32 w-32 text-xl',
  }

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
    '2xl': 128,
  }

  const controlIconSize =
    size === 'sm' || size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  const releaseObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  const beginWithFile = async (file: File) => {
    if (!onUpload) return
    if (!file.type.startsWith('image/')) return

    if (cropEnabled) {
      releaseObjectUrl()
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      setCropSrc(url)
      setCropOpen(true)
      return
    }

    await onUpload(file)
  }

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void beginWithFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!uploadEnabled) return
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void beginWithFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!uploadEnabled) return
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!uploadEnabled) return
    e.preventDefault()
    setDragOver(false)
  }

  const openGallery = () => {
    setViewOpen(false)
    // Defer past FsModal close so the hidden input click is not swallowed
    queueMicrotask(() => {
      galleryInputRef.current?.click()
    })
  }

  const openCamera = () => {
    setViewOpen(false)
    setCameraOpen(true)
  }

  const handleSurfaceClick = () => {
    if (openViewerOnClick) {
      setViewOpen(true)
      return
    }
    if (canEdit) {
      if (uploadEnabled) {
        openGallery()
        return
      }
      if (cameraEnabled) {
        openCamera()
        return
      }
    }
    onClick?.()
  }

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const baseClasses =
    'relative flex items-center justify-center rounded-full bg-muted overflow-hidden group'
  const interactiveClasses =
    onClick || canEdit || openViewerOnClick
      ? 'cursor-pointer hover:opacity-90 transition-opacity'
      : ''
  const dragClasses = dragOver ? 'ring-2 ring-primary ring-offset-2' : ''

  const circle = (
    <div
      className={cn(baseClasses, sizeClasses[size], interactiveClasses, dragClasses, className)}
      onClick={handleSurfaceClick}
      onDrop={uploadEnabled ? handleDrop : undefined}
      onDragOver={uploadEnabled ? handleDragOver : undefined}
      onDragLeave={uploadEnabled ? handleDragLeave : undefined}
      role={canEdit || onClick || openViewerOnClick ? 'button' : undefined}
      tabIndex={canEdit || onClick || openViewerOnClick ? 0 : undefined}
      onKeyDown={
        canEdit || onClick || openViewerOnClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSurfaceClick()
              }
            }
          : undefined
      }
      aria-label={openViewerOnClick ? 'View profile photo' : undefined}
    >
      {uploadEnabled ? (
        <input
          ref={galleryInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onGalleryChange}
          className="hidden"
          disabled={uploading}
          aria-hidden
        />
      ) : null}

      {resolvedSrc ? (
        <Image
          src={resolvedSrc}
          alt={alt}
          width={sizePixels[size]}
          height={sizePixels[size]}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImageFailed(true)}
          unoptimized={!resolvedSrc.startsWith('/')}
        />
      ) : (
        <span className="font-medium text-muted-foreground">
          {fallback || alt.charAt(0).toUpperCase() || '?'}
        </span>
      )}

      {canEdit || openViewerOnClick ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {uploading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : openViewerOnClick ? (
            <Eye className="h-4 w-4 text-white" />
          ) : (
            <Camera className="h-4 w-4 text-white" />
          )}
        </div>
      ) : null}

      {uploadEnabled && dragOver ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/20">
          <Upload className="h-4 w-4 text-primary" />
        </div>
      ) : null}
    </div>
  )

  // Inline controls only when viewer-on-click is disabled (legacy compact edit)
  const controls =
    canEdit && !openViewerOnClick && (cameraEnabled || uploadEnabled) ? (
      <div className="flex items-center gap-2" onClick={stop}>
        {cameraEnabled ? (
          <button
            type="button"
            disabled={uploading}
            onClick={openCamera}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm',
              'hover:bg-muted hover:text-foreground disabled:opacity-50',
            )}
            aria-label="Take photo"
            title="Take photo"
          >
            <Camera className={controlIconSize} />
          </button>
        ) : null}
        {uploadEnabled ? (
          <button
            type="button"
            disabled={uploading}
            onClick={openGallery}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm',
              'hover:bg-muted hover:text-foreground disabled:opacity-50',
            )}
            aria-label="Upload photo"
            title="Upload photo"
          >
            <Upload className={controlIconSize} />
          </button>
        ) : null}
      </div>
    ) : null

  const viewModal = openViewerOnClick ? (
    <AvatarViewFsModal
      open={viewOpen}
      onOpenChange={setViewOpen}
      src={resolvedSrc}
      alt={alt}
      fallback={fallback || alt || '?'}
      showOwnerActions={canEdit}
      uploading={uploading}
      onCamera={cameraEnabled ? openCamera : undefined}
      onUpload={uploadEnabled ? openGallery : undefined}
    />
  ) : null

  const cameraModal = cameraEnabled ? (
    <AvatarCameraCaptureFsModal
      open={cameraOpen}
      onOpenChange={setCameraOpen}
      onCapture={(file) => {
        void beginWithFile(file)
      }}
    />
  ) : null

  const cropModal = cropEnabled ? (
    <AvatarCropFsModal
      open={cropOpen}
      onOpenChange={(next) => {
        setCropOpen(next)
        if (!next) {
          releaseObjectUrl()
          setCropSrc(null)
        }
      }}
      imageSrc={cropSrc}
      title={cropTitle}
      confirmLabel={cropConfirmLabel}
      cancelLabel={cropCancelLabel}
      onConfirm={async (file) => {
        await onUpload?.(file)
      }}
    />
  ) : null

  if (!canEdit && !openViewerOnClick) {
    return (
      <>
        {circle}
        {cropModal}
      </>
    )
  }

  return (
    <div className="relative inline-flex flex-col items-center gap-2">
      {circle}
      {controls}
      {viewModal}
      {cameraModal}
      {cropModal}
    </div>
  )
}

export function AvatarImage({ src, alt = '', className }: AvatarImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={cn('h-full w-full rounded-full object-cover', className)}
      onError={(e) => {
        const target = e.target as HTMLImageElement
        target.style.display = 'none'
      }}
      unoptimized={!src.startsWith('/')}
    />
  )
}

export function AvatarFallback({ children, className }: AvatarFallbackProps) {
  return (
    <span className={cn('font-medium text-muted-foreground', className)}>
      {children}
    </span>
  )
}
