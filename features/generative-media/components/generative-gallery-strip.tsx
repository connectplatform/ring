'use client'

/**
 * Shared gallery strip: upload JPG/PNG/WebP, primary + enabled, replace/delete.
 * Posts uploads into generative field chat (no caption).
 */

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { GalleryHorizontal, ImageIcon, Loader2, Replace, Trash2 } from 'lucide-react'
import {
  deleteGenMediaFileAction,
  postGenMediaUploadAction,
} from '@/app/_actions/generative-media'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type {
  GalleryItem,
  GenerativeGalleryValue,
  GenerativeMediaScope,
} from '@/features/generative-media/types'

export function GenerativeGalleryStrip({
  scope,
  pageSlug,
  fieldId,
  entityId,
  value,
  onChange,
  maxItems = 8,
  uploadPurpose = 'nft:media',
}: {
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  value: GenerativeGalleryValue
  onChange: (next: GenerativeGalleryValue) => void
  maxItems?: number
  uploadPurpose?: string
}) {
  const t = useTranslations('modules.generativeMedia')
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceTargetId = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const items = value.items
  const primary = items.find((i) => i.isPrimary) || items[0]

  function setItems(nextItems: GalleryItem[]) {
    onChange({ items: nextItems })
  }

  function openPicker(replaceId?: string) {
    replaceTargetId.current = replaceId || null
    inputRef.current?.click()
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(t('uploadJpgPng'))
      return
    }
    if (items.length >= maxItems && !replaceTargetId.current) {
      setError(t('maxItems', { count: maxItems }))
      return
    }

    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', uploadPurpose)
      formData.append('mediaIndex', fieldId)
      formData.append('fileCategory', replaceTargetId.current || String(Date.now()))
      if (entityId) formData.append('productId', entityId)

      const response = await fetch('/api/uploads', { method: 'POST', body: formData })
      const payload = (await response.json()) as {
        success?: boolean
        url?: string
        objectKey?: string
        contentType?: string
        fileId?: string
        derivatives?: GalleryItem['derivatives']
        error?: string
      }
      if (!response.ok || !payload.success || !payload.url) {
        setError(payload.error || t('uploadFailed'))
        return
      }

      const posted = await postGenMediaUploadAction({
        scope,
        pageSlug,
        fieldId,
        entityId,
        url: payload.url,
        contentType: payload.contentType || file.type,
        fileName: file.name,
        fileId: payload.fileId,
        derivatives: payload.derivatives,
        deriveWebp: !payload.derivatives,
      })

      if (!posted.success) {
        setError(posted.error || t('uploadFailed'))
        return
      }

      const nextItem: GalleryItem = {
        id: replaceTargetId.current || `up_${Date.now()}`,
        originalUrl: payload.url,
        webpUrl: posted.webpUrl || payload.derivatives?.original_webp || payload.derivatives?.thumb,
        derivatives: posted.derivatives || payload.derivatives,
        fileId: payload.fileId || posted.fileId,
        contentType: payload.contentType || file.type,
        source: 'upload',
        enabled: true,
        isPrimary: !primary || replaceTargetId.current === primary?.id || items.length === 0,
        messageId: posted.messageId,
        createdAt: new Date().toISOString(),
      }

      if (replaceTargetId.current) {
        const prev = items.find((i) => i.id === replaceTargetId.current)
        if (prev?.originalUrl) {
          await deleteGenMediaFileAction({ url: prev.originalUrl }).catch(() => null)
          if (prev.webpUrl) await deleteGenMediaFileAction({ url: prev.webpUrl }).catch(() => null)
        }
        setItems(
          items.map((i) =>
            i.id === replaceTargetId.current
              ? { ...nextItem, isPrimary: i.isPrimary }
              : i,
          ),
        )
      } else {
        const nextItems = items.map((i) =>
          nextItem.isPrimary ? { ...i, isPrimary: false } : i,
        )
        setItems([...nextItems, nextItem])
      }
      replaceTargetId.current = null
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function handleDelete(item: GalleryItem) {
    setError(null)
    startTransition(async () => {
      await deleteGenMediaFileAction({ url: item.originalUrl })
      if (item.webpUrl) await deleteGenMediaFileAction({ url: item.webpUrl }).catch(() => null)
      const nextItems = items.filter((i) => i.id !== item.id)
      if (item.isPrimary && nextItems[0]) nextItems[0] = { ...nextItems[0], isPrimary: true }
      setItems(nextItems)
    })
  }

  return (
    <div className="space-y-3">
      <Label>{t('uploadMedia')}</Label>
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
          <p className="text-sm text-muted-foreground">{t('uploadJpgPng')}</p>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => openPicker()}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GalleryHorizontal className="mr-2 h-4 w-4" />}
            {t('select')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primary.webpUrl || primary.originalUrl}
              alt={t('primaryAlt')}
              className="aspect-square w-full object-cover"
            />
            <div className="absolute right-2 top-2 flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                disabled={pending}
                onClick={() => openPicker(primary.id)}
                aria-label={t('replace')}
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
                aria-label={t('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item) => (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setItems(
                        items.map((i) => ({
                          ...i,
                          isPrimary: i.id === item.id,
                        })),
                      )
                    }
                    className={cn(
                      'relative aspect-square w-full overflow-hidden rounded-lg border-2',
                      item.isPrimary ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                      !item.enabled && 'opacity-40',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.webpUrl || item.originalUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) =>
                        setItems(
                          items.map((i) =>
                            i.id === item.id ? { ...i, enabled: e.target.checked } : i,
                          ),
                        )
                      }
                    />
                    {t('enabledSwipe')}
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || items.length >= maxItems}
            onClick={() => openPicker()}
          >
            <GalleryHorizontal className="mr-2 h-4 w-4" />
            {t('addVariation')}
          </Button>
        </div>
      )}
    </div>
  )
}
