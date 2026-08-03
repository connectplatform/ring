'use client'

/**
 * Avatar image viewer (FsModal) — DiagramViewer / product-lightbox inspired.
 * Owner sees Camera + Upload actions in the footer.
 */

import React from 'react'
import Image from 'next/image'
import { Camera, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FsModal } from '@/components/ui/fs-modal'
import { cn } from '@/lib/utils'

export type AvatarViewFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  src?: string | null
  alt?: string
  fallback?: string
  /** Owner / editable: show camera + upload */
  showOwnerActions?: boolean
  uploading?: boolean
  onCamera?: () => void
  onUpload?: () => void
  title?: string
}

export function AvatarViewFsModal({
  open,
  onOpenChange,
  src,
  alt = 'Profile photo',
  fallback = '?',
  showOwnerActions = false,
  uploading = false,
  onCamera,
  onUpload,
  title = 'Profile photo',
}: AvatarViewFsModalProps) {
  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="sm:max-w-2xl"
      contentClassName="!px-0 !py-0 bg-black/95"
      footer={
        showOwnerActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={uploading}
              onClick={onCamera}
            >
              <Camera className="h-4 w-4" />
              Camera
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
              disabled={uploading}
              onClick={onUpload}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="relative flex min-h-[min(70dvh,520px)] w-full items-center justify-center p-4 sm:p-6">
        {src ? (
          <div className="relative h-[min(60dvh,440px)] w-[min(60dvh,440px)] max-w-full">
            <Image
              src={src}
              alt={alt}
              fill
              className="rounded-full object-contain drop-shadow-2xl"
              unoptimized={!src.startsWith('/')}
              sizes="(max-width: 640px) 90vw, 440px"
              priority
            />
          </div>
        ) : (
          <div
            className={cn(
              'flex h-[min(50dvh,360px)] w-[min(50dvh,360px)] max-w-full items-center justify-center',
              'rounded-full bg-muted text-5xl font-semibold text-muted-foreground',
            )}
          >
            {fallback.charAt(0).toUpperCase()}
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        ) : null}
      </div>
    </FsModal>
  )
}
