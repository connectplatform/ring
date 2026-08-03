'use client'

import { useEffect, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  addGalleryItemAction,
  listGalleryAction,
  listGalleryCandidatesAction,
  removeGalleryItemAction,
  updateGalleryItemAction,
} from '@/app/_actions/file-cabinet'
import type { FileCabinetGalleryItem, FileCabinetNode } from '@/features/file-cabinet/types'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import { useLocale } from 'next-intl'
import type { Locale } from '@/i18n/shared'
import { FILE_CABINET_DOWNLOAD_PATH } from '@/features/file-cabinet/constants'

/**
 * Private gallery curator — reuses simple image strip patterns (generative/store style).
 */
export function FileCabinetGalleryManager({ publicImgHref }: { publicImgHref?: string }) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.fileCabinet')
  const [items, setItems] = useState<FileCabinetGalleryItem[]>([])
  const [candidates, setCandidates] = useState<FileCabinetNode[]>([])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    startTransition(async () => {
      try {
        setError(null)
        const [gallery, nodes] = await Promise.all([
          listGalleryAction(),
          listGalleryCandidatesAction(),
        ])
        setItems(gallery)
        setCandidates(nodes.filter((n) => !gallery.some((g) => g.nodeId === n.id)))
      } catch (e) {
        setError(e instanceof Error ? e.message : t('galleryLoadError'))
      }
    })
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('galleryIntro')}</p>
        {publicImgHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={toAppHref(publicImgHref)}>{t('openPublicGallery')}</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary" size="sm">
          <Link href={toAppHref(ROUTES.FILE_CABINET(locale))}>{t('openCabinet')}</Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('gallerySection', { count: items.length })}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const preview =
              item.visibility === 'public' && item.storageUrl
                ? item.storageUrl
                : `${FILE_CABINET_DOWNLOAD_PATH}?nodeId=${encodeURIComponent(item.nodeId)}&inline=1`
            return (
              <div key={item.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="relative aspect-square bg-muted">
                  {item.mime?.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt={item.caption || item.name || ''}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      {item.mime || 'media'}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-2">
                  <p className="truncate text-xs font-medium">{item.name || item.nodeId}</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                    value={item.visibility}
                    disabled={pending}
                    onChange={(e) => {
                      const visibility = e.target.value as FileCabinetGalleryItem['visibility']
                      startTransition(async () => {
                        await updateGalleryItemAction(item.id, { visibility })
                        reload()
                      })
                    }}
                  >
                    <option value="private">{t('visibilityPrivate')}</option>
                    <option value="unlisted">{t('visibilityUnlisted')}</option>
                    <option value="public">{t('visibilityPublic')}</option>
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await removeGalleryItemAction(item.id)
                        reload()
                      })
                    }}
                  >
                    {t('remove')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('fromCabinet')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {candidates.map((node) => {
            const preview = `${FILE_CABINET_DOWNLOAD_PATH}?nodeId=${encodeURIComponent(node.id)}&inline=1`
            return (
              <button
                key={node.id}
                type="button"
                disabled={pending}
                className="overflow-hidden rounded-xl border text-left transition hover:border-primary"
                onClick={() => {
                  startTransition(async () => {
                    await addGalleryItemAction(node.id, 'private')
                    reload()
                  })
                }}
              >
                <div className="relative aspect-square bg-muted">
                  {node.mime?.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={node.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p className="truncate p-2 text-xs">{node.name}</p>
              </button>
            )
          })}
          {candidates.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">
              {t('galleryEmptyCandidates')}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
