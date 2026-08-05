'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { FsModal } from '@/components/ui/fs-modal'
import { Button } from '@/components/ui/button'
import {
  listGalleryAction,
  listGalleryCandidatesAction,
} from '@/app/_actions/file-cabinet'
import type { FileCabinetGalleryItem, FileCabinetNode } from '@/features/file-cabinet/types'
import { FILE_CABINET_DOWNLOAD_PATH } from '@/features/file-cabinet/constants'
import { cn } from '@/lib/utils'

export type WikiImagePick = {
  src: string
  alt: string
}

type WikiImageGalleryFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (image: WikiImagePick) => void
}

function previewUrl(item: { nodeId: string; storageUrl?: string; visibility?: string }) {
  if (item.visibility === 'public' && item.storageUrl) return item.storageUrl
  return `${FILE_CABINET_DOWNLOAD_PATH}?nodeId=${encodeURIComponent(item.nodeId)}&inline=1`
}

function insertUrl(item: { nodeId: string; storageUrl?: string; visibility?: string }) {
  // Prefer durable CDN for public; otherwise authenticated download URL.
  if (item.storageUrl) return item.storageUrl
  return `${FILE_CABINET_DOWNLOAD_PATH}?nodeId=${encodeURIComponent(item.nodeId)}&inline=1`
}

/**
 * Pick an image from the member gallery / cabinet candidates into WikiRichEditor.
 */
export function WikiImageGalleryFsModal({
  open,
  onOpenChange,
  onPick,
}: WikiImageGalleryFsModalProps) {
  const t = useTranslations('editor.toolbar')
  const tCabinet = useTranslations('modules.fileCabinet')
  const [gallery, setGallery] = useState<FileCabinetGalleryItem[]>([])
  const [candidates, setCandidates] = useState<FileCabinetNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    startTransition(async () => {
      setError(null)
      try {
        const [items, nodes] = await Promise.all([
          listGalleryAction(),
          listGalleryCandidatesAction().catch(() => [] as FileCabinetNode[]),
        ])
        setGallery(items.filter((i) => (i.mime || '').startsWith('image/') || !i.mime))
        setCandidates(nodes.filter((n) => (n.mime || '').startsWith('image/')))
      } catch (e) {
        setGallery([])
        setCandidates([])
        setError(e instanceof Error ? e.message : t('galleryLoadFailed'))
      }
    })
  }, [open, t])

  const candidateExtras = useMemo(() => {
    const inGallery = new Set(gallery.map((g) => g.nodeId))
    return candidates.filter((n) => !inGallery.has(n.id))
  }, [gallery, candidates])

  const empty = !pending && gallery.length === 0 && candidateExtras.length === 0

  return (
    <FsModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('imageGalleryTitle')}
      description={t('imageGalleryDesc')}
      hideHeaderSeparator
      className="sm:h-[100dvh] sm:max-h-[100dvh] sm:max-w-2xl"
      contentClassName="space-y-4"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </div>
      }
    >
      {pending ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('galleryLoading')}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {empty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('galleryEmpty')}</p>
      ) : null}

      {gallery.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tCabinet('gallerySection', { count: gallery.length })}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'overflow-hidden rounded-lg border bg-card text-left transition',
                  'hover:border-[var(--davinci-beam)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                onClick={() => {
                  onPick({
                    src: insertUrl(item),
                    alt: item.caption || item.name || '',
                  })
                  onOpenChange(false)
                }}
              >
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl(item)}
                    alt={item.caption || item.name || ''}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="truncate px-2 py-1.5 text-xs font-medium">
                  {item.name || item.nodeId.slice(0, 8)}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {candidateExtras.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tCabinet('fromCabinet')}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {candidateExtras.map((node) => (
              <button
                key={node.id}
                type="button"
                className={cn(
                  'overflow-hidden rounded-lg border bg-card text-left transition',
                  'hover:border-[var(--davinci-beam)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                onClick={() => {
                  onPick({
                    src: insertUrl({ nodeId: node.id }),
                    alt: node.name || '',
                  })
                  onOpenChange(false)
                }}
              >
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl({ nodeId: node.id })}
                    alt={node.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="truncate px-2 py-1.5 text-xs font-medium">{node.name}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </FsModal>
  )
}
