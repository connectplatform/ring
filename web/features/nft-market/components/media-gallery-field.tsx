'use client'

/**
 * Shared field gallery: upload JPG/PNG variations, select primary, replace/delete via file().
 */

import { useRef, useState, useTransition } from 'react'
import { GalleryHorizontal, ImageIcon, Loader2, Replace, Trash2 } from 'lucide-react'
import { deleteNftMediaAction } from '@/app/_actions/nft-member'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { MediaGalleryItem } from '@/features/nft-market/media-types'

export function MediaGalleryField({
  name = 'imageUri',
  fieldId = 'imageUri',
  label = 'Upload media',
  items,
  primaryId,
  onChange,
  maxItems = 8,
}: {
  name?: string
  fieldId?: string
  label?: string
  items: MediaGalleryItem[]
  primaryId?: string
  onChange: (next: { items: MediaGalleryItem[]; primaryId?: string }) => void
  maxItems?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceTargetId = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const primary = items.find((i) => i.id === primaryId) || items[0]

  function openPicker(replaceId?: string) {
    replaceTargetId.current = replaceId || null
    inputRef.current?.click()
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload JPG or PNG media')
      return
    }
    if (items.length >= maxItems && !replaceTargetId.current) {
      setError(`Maximum ${maxItems} media items`)
      return
    }

    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', 'nft:media')
      formData.append('mediaIndex', fieldId)
      formData.append('fileCategory', replaceTargetId.current || String(Date.now()))

      const response = await fetch('/api/uploads', { method: 'POST', body: formData })
      const payload = (await response.json()) as {
        success?: boolean
        url?: string
        objectKey?: string
        contentType?: string
        error?: string
      }
      if (!response.ok || !payload.success || !payload.url) {
        setError(payload.error || 'Upload failed')
        return
      }

      const nextItem: MediaGalleryItem = {
        id: replaceTargetId.current || `up_${Date.now()}`,
        url: payload.url,
        fileId: payload.objectKey,
        contentType: payload.contentType || file.type,
        source: 'upload',
        createdAt: new Date().toISOString(),
      }

      if (replaceTargetId.current) {
        const prev = items.find((i) => i.id === replaceTargetId.current)
        if (prev?.url) {
          await deleteNftMediaAction({ url: prev.url }).catch(() => null)
        }
        const nextItems = items.map((i) => (i.id === replaceTargetId.current ? nextItem : i))
        onChange({ items: nextItems, primaryId: primaryId || nextItem.id })
      } else {
        const nextItems = [...items, nextItem]
        onChange({
          items: nextItems,
          primaryId: primaryId || nextItem.id,
        })
      }
      replaceTargetId.current = null
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function handleDelete(item: MediaGalleryItem) {
    setError(null)
    startTransition(async () => {
      const result = await deleteNftMediaAction({ url: item.url })
      if (!result.success) {
        setError(result.error || 'Delete failed')
        return
      }
      const nextItems = items.filter((i) => i.id !== item.id)
      const nextPrimary =
        primaryId === item.id ? nextItems[0]?.id : primaryId && nextItems.some((i) => i.id === primaryId)
          ? primaryId
          : nextItems[0]?.id
      onChange({ items: nextItems, primaryId: nextPrimary })
    })
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!primary ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Upload JPG and PNG media</p>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => openPicker()}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GalleryHorizontal className="mr-2 h-4 w-4" />}
            Select
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={primary.url} alt="Primary NFT media" className="aspect-square w-full object-cover" />
            <div className="absolute right-2 top-2 flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                disabled={pending}
                onClick={() => openPicker(primary.id)}
                aria-label="Replace"
              >
                <Replace className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                disabled={pending}
                onClick={() => handleDelete(primary)}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {items.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={pending}
                  onClick={() => onChange({ items, primaryId: item.id })}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg border-2',
                    item.id === primary.id ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <Button type="button" variant="outline" size="sm" disabled={pending || items.length >= maxItems} onClick={() => openPicker()}>
            <GalleryHorizontal className="mr-2 h-4 w-4" />
            Add variation
          </Button>
        </div>
      )}

      <input type="hidden" name={name} value={primary?.url || ''} />
    </div>
  )
}
