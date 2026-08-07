'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useTranslations } from 'next-intl'
import { Heart, Loader2, Pencil, Upload, X } from 'lucide-react'
import { FsModal } from '@/components/ui/fs-modal'
import { Button } from '@/components/ui/button'
import { QuickSearchFilter } from '@/components/common/quick-search-filter'
import { SortByMenu, type SortOption } from '@/components/common/sort-by-menu'
import {
  addGalleryItemAction,
  listGalleryAction,
  listGalleryCandidatesAction,
  uploadCabinetFileAction,
} from '@/app/_actions/file-cabinet'
import type {
  FileCabinetGalleryItem,
  FileCabinetNode,
} from '@/features/file-cabinet/types'
import { cabinetDownloadUrl } from '@/features/file-cabinet/media-urls'
import { GenerativeMediaEditorFsModal } from '@/features/generative-media/components/generative-media-editor-fs-modal'
import { displayGalleryUrl, type GalleryItem } from '@/features/generative-media/types'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'

export type WikiImagePick = {
  src: string
  alt: string
  /** RingBase file id when known — enables derivative URLs in consumers. */
  fileId?: string
}

type WikiImageGalleryFsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (image: WikiImagePick) => void
}

type GalleryTile = {
  key: string
  nodeId: string
  name: string
  mime?: string
  /** Gallery / cabinet row createdAt — “date added”. */
  createdAt: string
  /**
   * “Date taken” — EXIF not on gallery SSOT yet; fall back to createdAt.
   * TODO TBD: wire EXIF dateTaken when cabinet metadata lands.
   */
  dateTaken: string
  caption?: string
  source: 'gallery' | 'cabinet'
}

type GallerySort =
  | 'date-added'
  | 'date-taken'
  | 'type'
  | 'file-name'

type UploadPreview = {
  nodeId: string
  name: string
  storageFileId?: string
}

const IMAGE_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'

/** Device-friendly gallery preview — thumb.webp ladder (falls back upstream). */
function galleryPreviewUrl(nodeId: string): string {
  return cabinetDownloadUrl(nodeId, { inline: true, variant: 'thumb' })
}

/** Insert / edit reference — original.webp (processed WebP). */
function galleryInsertUrl(nodeId: string, bust?: number): string {
  const base = cabinetDownloadUrl(nodeId, {
    inline: true,
    variant: 'original_webp',
  })
  return bust ? `${base}&_=${bust}` : base
}

/**
 * Wait for processed WebP derivative — show spinner while variant 404s / fails,
 * then reveal. Retries with cache-bust until ready or max attempts.
 */
function WebpReadyImage({
  nodeId,
  alt,
  className,
}: {
  nodeId: string
  alt: string
  className?: string
}) {
  const [bust, setBust] = useState(0)
  const [ready, setReady] = useState(false)
  const attempts = useRef(0)

  useEffect(() => {
    setReady(false)
    setBust(0)
    attempts.current = 0
  }, [nodeId])

  const src = galleryInsertUrl(nodeId, bust || undefined)

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {!ready ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={alt}
        className={cn(
          'h-full w-full object-contain transition-opacity',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => setReady(true)}
        onError={() => {
          if (attempts.current >= 12) return
          attempts.current += 1
          window.setTimeout(() => setBust(Date.now()), 700)
        }}
      />
    </div>
  )
}

function toGalleryTiles(
  gallery: FileCabinetGalleryItem[],
  candidates: FileCabinetNode[],
): GalleryTile[] {
  const inGallery = new Set(gallery.map((g) => g.nodeId))
  const fromGallery: GalleryTile[] = gallery.map((item) => ({
    key: `g-${item.id}`,
    nodeId: item.nodeId,
    name: item.name || item.caption || item.nodeId.slice(0, 8),
    mime: item.mime,
    createdAt: item.createdAt,
    dateTaken: item.createdAt,
    caption: item.caption,
    source: 'gallery',
  }))
  const fromCabinet: GalleryTile[] = candidates
    .filter((n) => !inGallery.has(n.id))
    .map((node) => ({
      key: `c-${node.id}`,
      nodeId: node.id,
      name: node.name,
      mime: node.mime,
      createdAt: node.createdAt,
      dateTaken: node.createdAt,
      source: 'cabinet',
    }))
  return [...fromGallery, ...fromCabinet]
}

function sortTiles(tiles: GalleryTile[], sort: GallerySort): GalleryTile[] {
  const next = [...tiles]
  const byTimeDesc = (a: string, b: string) =>
    new Date(b).getTime() - new Date(a).getTime()
  switch (sort) {
    case 'date-added':
      return next.sort((a, b) => byTimeDesc(a.createdAt, b.createdAt))
    case 'date-taken':
      return next.sort((a, b) => byTimeDesc(a.dateTaken, b.dateTaken))
    case 'type':
      return next.sort((a, b) =>
        (a.mime || '').localeCompare(b.mime || '', undefined, {
          sensitivity: 'base',
        }),
      )
    case 'file-name':
    default:
      return next.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      )
  }
}

/**
 * Pick an image from the member gallery / cabinet candidates into WikiRichEditor.
 * Desktop: near-full viewport FsModal (equal inset to top/bottom); mobile: full-bleed.
 */
export function WikiImageGalleryFsModal({
  open,
  onOpenChange,
  onPick,
}: WikiImageGalleryFsModalProps) {
  const t = useTranslations('editor.toolbar')
  const fileRef = useRef<HTMLInputElement>(null)
  const [gallery, setGallery] = useState<FileCabinetGalleryItem[]>([])
  const [candidates, setCandidates] = useState<FileCabinetNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<GallerySort>('date-added')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null)
  const [genOpen, setGenOpen] = useState(false)

  const reload = useCallback(async () => {
    const [items, nodes] = await Promise.all([
      listGalleryAction(),
      listGalleryCandidatesAction().catch(() => [] as FileCabinetNode[]),
    ])
    setGallery(
      items.filter((i) => (i.mime || '').startsWith('image/') || !i.mime),
    )
    setCandidates(nodes.filter((n) => (n.mime || '').startsWith('image/')))
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSort('date-added')
    setSelectedKey(null)
    setUploadPreview(null)
    setGenOpen(false)
    startTransition(async () => {
      setError(null)
      try {
        await reload()
      } catch (e) {
        setGallery([])
        setCandidates([])
        setError(e instanceof Error ? e.message : t('galleryLoadFailed'))
      }
    })
  }, [open, reload, t])

  const sortOptions: SortOption[] = useMemo(
    () => [
      { value: 'date-added', label: t('gallerySortDateAdded') },
      { value: 'date-taken', label: t('gallerySortDateTaken') },
      { value: 'type', label: t('gallerySortType') },
      { value: 'file-name', label: t('gallerySortFileName') },
    ],
    [t],
  )

  const tiles = useMemo(() => {
    const all = toGalleryTiles(gallery, candidates)
    const q = query.trim().toLowerCase()
    const filtered = q
      ? all.filter(
          (tile) =>
            tile.name.toLowerCase().includes(q) ||
            (tile.caption || '').toLowerCase().includes(q) ||
            (tile.mime || '').toLowerCase().includes(q),
        )
      : all
    return sortTiles(filtered, sort)
  }, [gallery, candidates, query, sort])

  const selected = tiles.find((tile) => tile.key === selectedKey) ?? null
  const empty = !pending && tiles.length === 0 && !uploadPreview

  const pickNode = (nodeId: string, alt: string, fileId?: string) => {
    onPick({
      src: galleryInsertUrl(nodeId),
      alt,
      fileId,
    })
    onOpenChange(false)
  }

  const handleInsert = () => {
    if (uploadPreview) {
      pickNode(uploadPreview.nodeId, uploadPreview.name, uploadPreview.storageFileId)
      return
    }
    if (!selected) return
    pickNode(selected.nodeId, selected.caption || selected.name || '')
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(t('galleryUploadImagesOnly'))
      return
    }
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadCabinetFileAction(fd)
      if (result.ok === false) throw new Error(result.error)
      const node = result.node
      try {
        await addGalleryItemAction(node.id, 'private')
      } catch {
        /* already in gallery or non-fatal — still preview */
      }
      await reload()
      const preview: UploadPreview = {
        nodeId: node.id,
        name: node.name,
        storageFileId: node.storageFileId,
      }
      setUploadPreview(preview)
      setSelectedKey(`c-${node.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('galleryUploadFailed'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleGenUse = (item: GalleryItem) => {
    onPick({
      src: displayGalleryUrl(item),
      alt: uploadPreview?.name || selected?.name || '',
      fileId: item.fileId,
    })
    setGenOpen(false)
    onOpenChange(false)
  }

  const editTarget = uploadPreview || selected
  const insertEnabled = Boolean(uploadPreview || selected)

  return (
    <>
      <FsModal
        open={open}
        onOpenChange={onOpenChange}
        title={t('imageGalleryTitle')}
        layout="centerPane"
        hideHeaderSeparator
        hideFooterSeparator
        hideTitleOnMobile
        hideCloseButton
        // Fill viewport height (inset-3 = 0.75rem×2) so gallery flex-1 can expand.
        // Override centerPane `lg:!h-auto` which otherwise collapses to content height.
        className="max-lg:!pt-0 lg:!inset-3 lg:!left-3 lg:!right-3 lg:!h-[calc(100dvh-1.5rem)]"
        // Flush title→filters (match mobile top alignment); compact close.
        headerClassName="max-sm:hidden sm:flex sm:items-center !space-y-0 !px-2 !pb-0 !pt-1.5 sm:!px-2"
        titleClassName="!text-xl sm:!text-2xl leading-none"
        headerActions={
          <button
            type="button"
            className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background/90 text-foreground opacity-90 shadow-sm backdrop-blur-sm transition-[opacity,background-color,transform] hover:bg-muted hover:opacity-100 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
            aria-label={t('close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </button>
        }
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
        // Prevent Dialog from focusing the search input (mobile keyboard overlay).
        onOpenAutoFocus={(e) => e.preventDefault()}
        footerClassName={cn(
          'mt-auto shrink-0 !px-0 border-t border-border/60',
          'py-2 sm:py-2',
          'max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
        footer={
          <div className="flex w-full items-center gap-2 px-1.5 sm:px-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={IMAGE_ACCEPT}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
              }}
            />
            <Button
              type="button"
              className="h-11 gap-1.5 px-4 text-sm"
              disabled={uploading || pending}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5" />
              )}
              {t('galleryUpload')}
            </Button>
            <div className="ml-auto flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full px-4 text-sm"
                disabled={!insertEnabled}
                onClick={handleInsert}
              >
                {t('galleryInsert')}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {/* Top toolbar flush under title (desktop/iPad same as mobile) */}
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 px-1.5 pb-1 pt-0 sm:px-2">
            {/* TODO TBD: wire with /favorites */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={t('galleryFavorites')}
              title={t('galleryFavorites')}
              disabled
            >
              <Heart className="size-5" />
            </Button>
            <QuickSearchFilter
              value={query}
              onChange={setQuery}
              placeholder={t('gallerySearchPlaceholder')}
              aria-label={t('gallerySearchPlaceholder')}
              className="min-w-0 flex-1"
              inputClassName="h-9"
            />
            <SortByMenu
              currentSort={sort}
              onSortChange={(v) => setSort(v as GallerySort)}
              options={sortOptions}
              title={t('gallerySortBy')}
              triggerLabel={t('gallerySortBy')}
              align="end"
            />
          </div>

          {/* Gallery glass pane — fills remaining viewport under filters */}
          <div
            className={cn(
              'wiki-editor-glass-pane mx-1.5 mb-1.5 flex min-h-0 flex-1 flex-col overflow-hidden sm:mx-2 sm:mb-2',
              davinciGlassSurface,
              'bg-[color-mix(in_oklch,var(--davinci-surface-bg)_88%,transparent)]',
            )}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5 sm:p-2">
              {pending ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('galleryLoading')}
                </div>
              ) : null}

              {error ? (
                <p className="mb-2 text-sm text-destructive">{error}</p>
              ) : null}

              {empty ? (
                <p className="flex h-full min-h-[12rem] items-center justify-center text-center text-sm text-muted-foreground">
                  {t('galleryEmpty')}
                </p>
              ) : null}

              {!pending && tiles.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                  {tiles.map((tile) => {
                    const active =
                      selectedKey === tile.key ||
                      uploadPreview?.nodeId === tile.nodeId
                    return (
                      <button
                        key={tile.key}
                        type="button"
                        className={cn(
                          'overflow-hidden rounded-lg border bg-card text-left transition',
                          'hover:border-[var(--davinci-beam)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active &&
                            'border-[var(--davinci-beam)] ring-2 ring-[var(--davinci-beam)]/40',
                        )}
                        onClick={() => {
                          setSelectedKey(tile.key)
                          setUploadPreview(null)
                        }}
                        onDoubleClick={() => {
                          pickNode(
                            tile.nodeId,
                            tile.caption || tile.name || '',
                          )
                        }}
                      >
                        <div className="relative aspect-square bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={galleryPreviewUrl(tile.nodeId)}
                            alt={tile.caption || tile.name || ''}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <p className="truncate px-2 py-1.5 text-xs font-medium">
                          {tile.name}
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            {/* Post-upload WebP preview + Insert / Edit */}
            {uploadPreview ? (
              <div className="flex shrink-0 flex-col gap-3 border-t border-border/60 bg-background/80 p-3 backdrop-blur-sm sm:flex-row sm:items-center">
                <WebpReadyImage
                  nodeId={uploadPreview.nodeId}
                  alt={uploadPreview.name}
                  className="mx-auto aspect-square w-full max-w-[10rem] rounded-lg border border-border sm:mx-0"
                />
                <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
                  <p className="truncate text-sm font-medium">
                    {uploadPreview.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('galleryUploadPreviewHint')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                  <Button
                    type="button"
                    className="h-10 gap-1.5 rounded-full px-4 text-sm"
                    onClick={() =>
                      pickNode(
                        uploadPreview.nodeId,
                        uploadPreview.name,
                        uploadPreview.storageFileId,
                      )
                    }
                  >
                    {t('galleryInsert')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-1.5 px-4 text-sm"
                    onClick={() => setGenOpen(true)}
                  >
                    <Pencil className="size-4" />
                    {t('galleryEdit')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </FsModal>

      <GenerativeMediaEditorFsModal
        open={genOpen}
        onOpenChange={setGenOpen}
        scope="editor"
        pageSlug="wiki-gallery"
        fieldId={editTarget?.nodeId || 'wiki-gallery'}
        purpose="wiki-gallery-edit"
        actionUrl="/profile"
        context={{ name: editTarget?.name }}
        referenceImageUrl={
          editTarget ? galleryInsertUrl(editTarget.nodeId) : undefined
        }
        initialMode="image"
        onUseImage={handleGenUse}
      />
    </>
  )
}
