'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  getCabinetImageMetaAction,
  getCabinetStorageMetaAction,
  type CabinetImageMeta,
  type CabinetStorageMeta,
} from '@/app/_actions/file-cabinet'
import { cabinetDownloadUrl } from '@/features/file-cabinet/media-urls'
import type { FileCabinetNode } from '@/features/file-cabinet/types'
import {
  FileCabinetInfoMetaSkeleton,
  FileCabinetPreviewSkeleton,
} from '@/features/file-cabinet/components/file-cabinet-skeletons'

type Props = {
  node: FileCabinetNode | null
  displayName?: string
  className?: string
  onOpenImage?: (node: FileCabinetNode) => void
  canGenerate?: boolean
  onGenerateImage?: (node: FileCabinetNode) => void
  onGenerateVideo?: (node: FileCabinetNode) => void
}

function formatBytes(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

/**
 * Read-only info panel — corner chips show dims / format only.
 * Skeletons reserve meta + preview height while loading.
 */
export function FileCabinetDetailPanel({
  node,
  displayName,
  className,
  onOpenImage,
  canGenerate,
  onGenerateImage,
  onGenerateVideo,
}: Props) {
  const t = useTranslations('modules.fileCabinet')
  const [pending, startTransition] = useTransition()
  const [imageMeta, setImageMeta] = useState<CabinetImageMeta | null>(null)
  const [storageMeta, setStorageMeta] = useState<CabinetStorageMeta | null>(null)
  const [metaReady, setMetaReady] = useState(false)

  useEffect(() => {
    setImageMeta(null)
    setStorageMeta(null)
    setMetaReady(false)
    if (!node) return
    startTransition(async () => {
      try {
        const storage = await getCabinetStorageMetaAction(node.id)
        setStorageMeta(storage)
      } catch {
        setStorageMeta({
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        })
      }
      if (node.mime?.startsWith('image/')) {
        try {
          setImageMeta(await getCabinetImageMetaAction(node.id))
        } catch {
          setImageMeta(null)
        }
      }
      setMetaReady(true)
    })
  }, [node?.id, node?.mime, node?.createdAt, node?.updatedAt])

  if (!node) {
    return (
      <aside className={cn('shrink-0 px-1 py-2 text-xs text-muted-foreground', className)}>
        {t('selectHint')}
      </aside>
    )
  }

  const previewUrl = cabinetDownloadUrl(node.id, {
    inline: true,
    variant: 'original_webp',
  })
  const isImage = Boolean(node.mime?.startsWith('image/'))
  const isAudio = Boolean(node.mime?.startsWith('audio/'))
  const isVideo = Boolean(node.mime?.startsWith('video/'))
  const mediaUrl = cabinetDownloadUrl(node.id, { inline: true })
  const title = displayName || node.name
  const created = storageMeta?.createdAt || node.createdAt
  const updated = storageMeta?.updatedAt || node.updatedAt
  const size = storageMeta?.size ?? node.size
  const mime = storageMeta?.contentType || node.mime
  const showMetaSkeleton = pending && !metaReady

  return (
    <aside className={cn('shrink-0 space-y-3 overflow-hidden px-1 pt-2', className)}>
      {showMetaSkeleton ? (
        <FileCabinetInfoMetaSkeleton />
      ) : (
        <dl className="grid min-h-[4.5rem] grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {size != null ? (
            <>
              <dt className="text-muted-foreground">{t('size')}</dt>
              <dd>{formatBytes(size)}</dd>
            </>
          ) : null}
          {mime ? (
            <>
              <dt className="text-muted-foreground">{t('mime')}</dt>
              <dd className="truncate">{mime}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">{t('created')}</dt>
          <dd>{formatWhen(created)}</dd>
          <dt className="text-muted-foreground">{t('updated')}</dt>
          <dd>{formatWhen(updated)}</dd>
        </dl>
      )}

      {node.kind === 'file' && isImage ? (
        <div className="relative min-h-40 overflow-hidden rounded-md border bg-muted">
          {showMetaSkeleton ? (
            <FileCabinetPreviewSkeleton className="h-40 border-0" />
          ) : (
            <>
              <button
                type="button"
                className="block w-full cursor-zoom-in"
                onClick={() => onOpenImage?.(node)}
                aria-label={t('open')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={title}
                  className="max-h-40 w-full object-contain"
                />
              </button>
              {imageMeta?.width && imageMeta?.height ? (
                <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white backdrop-blur-sm">
                  {imageMeta.width} × {imageMeta.height}
                </span>
              ) : null}
              {imageMeta?.format ? (
                <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white backdrop-blur-sm">
                  {imageMeta.format}
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {node.kind === 'file' && (isAudio || isVideo) ? (
        <div className="min-h-10 space-y-1">
          {isAudio ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={mediaUrl} className="w-full" />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video controls src={mediaUrl} className="max-h-36 w-full rounded-md bg-black" />
          )}
        </div>
      ) : null}

      {node.kind === 'file' && isImage && canGenerate ? (
        <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onGenerateImage?.(node)}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {t('imageChat', { defaultValue: 'Image chat' })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onGenerateVideo?.(node)}
          >
            <Video className="mr-1.5 h-3.5 w-3.5" />
            {t('videoChat', { defaultValue: 'Video chat' })}
          </Button>
        </div>
      ) : null}
    </aside>
  )
}
