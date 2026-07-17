'use client'

/**
 * Fullscreen generative media editor — history + swipe + Ghost-write + Use this image.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Wand2 } from 'lucide-react'
import {
  listGenMediaMessagesAction,
  runGenMediaImageAction,
  runGhostWriteAction,
} from '@/app/_actions/generative-media'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  GHOST_WRITE_SENDER_ID,
  IMAGE_CONDUCTOR_SENDER_ID,
  type GalleryItem,
  type GenerativeMediaScope,
} from '@/features/generative-media/types'

type HistoryMessage = {
  id: string
  senderId: string
  senderName: string
  content: string
  type: string
  timestamp: string
  attachments?: Array<{ url: string; name: string; type: string }>
}

type PreviewImage = { url: string; webpUrl?: string; recordId?: string }

export function GenerativeMediaEditorFsModal({
  open,
  onOpenChange,
  scope,
  pageSlug,
  fieldId,
  entityId,
  purpose,
  actionUrl,
  context,
  referenceImageUrl,
  onUseImage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: GenerativeMediaScope
  pageSlug: string
  fieldId: string
  entityId?: string
  purpose?: string
  actionUrl?: string
  context?: {
    name?: string
    category?: string
    description?: string
    vendorName?: string
  }
  referenceImageUrl?: string
  onUseImage: (item: GalleryItem) => void
}) {
  const t = useTranslations('modules.generativeMedia')
  const [prompt, setPrompt] = useState('')
  const [previews, setPreviews] = useState<PreviewImage[]>([])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [modalFocused, setModalFocused] = useState(true)
  const [genMode, setGenMode] = useState<'image' | 'video'>('image')

  const selected = previews[previewIdx]
  const lineCount = Math.min(6, Math.max(1, prompt.split('\n').length + (prompt.length > 72 ? 1 : 0)))

  const loadHistory = useCallback(() => {
    startTransition(async () => {
      const result = await listGenMediaMessagesAction({ scope, pageSlug, fieldId, entityId })
      if (!result.success) {
        setError(result.error || t('historyFailed'))
        return
      }
      setMessages(result.messages || [])
      const lastAgent = [...(result.messages || [])]
        .reverse()
        .find((m) => m.senderId === IMAGE_CONDUCTOR_SENDER_ID && m.attachments?.length)
      if (lastAgent?.attachments?.length) {
        setPreviews(lastAgent.attachments.map((a) => ({ url: a.url })))
        setPreviewIdx(0)
      }
    })
  }, [scope, pageSlug, fieldId, entityId, t])

  useEffect(() => {
    if (!open) return
    setError(null)
    setModalFocused(true)
    loadHistory()
  }, [open, loadHistory])

  useEffect(() => {
    if (!open) return
    const onVisibility = () => setModalFocused(document.visibilityState === 'visible')
    const onBlur = () => setModalFocused(false)
    const onFocus = () => setModalFocused(true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [open])

  const userTurns = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.senderId !== IMAGE_CONDUCTOR_SENDER_ID &&
          m.senderId !== GHOST_WRITE_SENDER_ID &&
          m.type !== 'system',
      ),
    [messages],
  )

  function handleGenerate() {
    if (genMode === 'video') {
      setError(t('modeVideoSoon'))
      return
    }
    const text = prompt.trim()
    if (!text) {
      setError(t('emptyTitle'))
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await runGenMediaImageAction({
        scope,
        pageSlug,
        fieldId,
        entityId,
        prompt: text,
        purpose,
        actionUrl,
        referenceImageUrls: referenceImageUrl ? [referenceImageUrl] : undefined,
        notifyIfBackground: !modalFocused || document.visibilityState !== 'visible',
      })
      if (!result.success || !result.images?.length) {
        setError(result.error || t('generateFailed'))
        await loadHistory()
        return
      }
      setPreviews(result.images)
      setPreviewIdx(0)
      setPrompt('')
      await loadHistory()
    })
  }

  function handleGhostWrite() {
    const text = prompt.trim()
    if (!text) {
      setError(t('emptyTitle'))
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await runGhostWriteAction({
        scope,
        pageSlug,
        fieldId,
        entityId,
        draft: text,
        context,
      })
      if (!result.success || !result.enrichedPrompt) {
        setError(result.error || t('ghostWriteFailed'))
        await loadHistory()
        return
      }
      setPrompt(result.enrichedPrompt)
      await loadHistory()
    })
  }

  function swipe(delta: number) {
    if (previews.length === 0) return
    setPreviewIdx((idx) => (idx + delta + previews.length) % previews.length)
  }

  const currentUserCaption =
    userTurns.length > 0 ? userTurns[userTurns.length - 1]?.content : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex h-[min(94vh,920px)] w-[min(98vw,1200px)] max-w-none translate-x-[-50%] translate-y-[-50%]',
          'flex-col gap-0 overflow-hidden p-0 sm:rounded-xl',
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left md:px-6">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
          <Tabs
            value={genMode}
            onValueChange={(v) => setGenMode(v === 'video' ? 'video' : 'image')}
            className="mt-3"
          >
            <TabsList>
              <TabsTrigger value="image">{t('modeImage')}</TabsTrigger>
              <TabsTrigger value="video">{t('modeVideo')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {genMode === 'video' ? (
            <p className="mt-2 text-xs text-muted-foreground">{t('modeVideoSoon')}</p>
          ) : null}
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative flex min-h-0 flex-[1] flex-col border-b md:w-1/2 md:border-b-0 md:border-r">
            <div className="relative min-h-0 flex-1 bg-muted/40">
              {pending && previews.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">{t('generating')}</p>
                </div>
              ) : selected?.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.webpUrl || selected.url}
                    alt={`Variation ${previewIdx + 1}`}
                    className="h-full w-full object-contain"
                    onTouchStart={(e) => {
                      const x = e.touches[0]?.clientX
                      ;(e.currentTarget as HTMLElement).dataset.touchX = String(x ?? 0)
                    }}
                    onTouchEnd={(e) => {
                      const start = Number((e.currentTarget as HTMLElement).dataset.touchX || 0)
                      const end = e.changedTouches[0]?.clientX ?? start
                      if (end - start > 40) swipe(-1)
                      if (start - end > 40) swipe(1)
                    }}
                  />
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 md:inline-flex"
                    onClick={() => swipe(-1)}
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 md:inline-flex"
                    onClick={() => swipe(1)}
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  {previews.length > 1 ? (
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {previews.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Variation ${i + 1}`}
                          onClick={() => setPreviewIdx(i)}
                          className={cn(
                            'h-2 w-2 rounded-full',
                            i === previewIdx ? 'bg-primary' : 'bg-background/70',
                          )}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8" />
                  <p className="text-sm font-medium text-foreground">{t('emptyTitle')}</p>
                  <p className="max-w-sm text-xs">{t('emptyBody')}</p>
                </div>
              )}
            </div>

            {currentUserCaption && selected?.url ? (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground md:hidden">
                <p className="line-clamp-3">{currentUserCaption}</p>
              </div>
            ) : null}

            <div className="hidden border-t p-3 md:block">
              <Button
                type="button"
                className="w-full"
                disabled={!selected?.url || pending}
                onClick={() => {
                  if (!selected?.url) return
                  onUseImage({
                    id: selected.recordId || `gen_${Date.now()}`,
                    originalUrl: selected.url,
                    webpUrl: selected.webpUrl,
                    contentType: 'image/png',
                    source: 'generated',
                    enabled: true,
                    isPrimary: true,
                    createdAt: new Date().toISOString(),
                  })
                  onOpenChange(false)
                }}
              >
                {t('useThisImage')}
              </Button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 md:hidden">
            <Button
              type="button"
              size="sm"
              className="pointer-events-auto shadow-lg"
              disabled={!selected?.url || pending}
              onClick={() => {
                if (!selected?.url) return
                onUseImage({
                  id: selected.recordId || `gen_${Date.now()}`,
                  originalUrl: selected.url,
                  webpUrl: selected.webpUrl,
                  contentType: 'image/png',
                  source: 'generated',
                  enabled: true,
                  isPrimary: true,
                  createdAt: new Date().toISOString(),
                })
                onOpenChange(false)
              }}
            >
              {t('useThisImage')}
            </Button>
          </div>

          <div className="flex min-h-0 flex-[1] flex-col md:w-1/2">
            {error ? (
              <Alert variant="destructive" className="m-3 mb-0">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 md:px-4">
              {userTurns.length === 0 && !pending ? (
                <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
              ) : null}
              {userTurns.map((msg) => {
                const thumb =
                  msg.attachments?.[0]?.url ||
                  messages.find(
                    (m) =>
                      m.senderId === IMAGE_CONDUCTOR_SENDER_ID &&
                      getMessageTimeMs(m.timestamp) >= getMessageTimeMs(msg.timestamp),
                  )?.attachments?.[0]?.url
                return (
                  <div key={msg.id} className="flex gap-3 rounded-lg border bg-card p-2">
                    <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted md:block">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{t('you')}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      {msg.content ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm">{msg.content}</p>
                      ) : (
                        <p className="mt-1 text-xs italic text-muted-foreground">{t('uploadNoCaption')}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="shrink-0 border-t p-3">
              {referenceImageUrl ? (
                <p className="mb-2 text-xs text-muted-foreground">{t('editingWithReference')}</p>
              ) : null}
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={pending}
                rows={lineCount}
                className="resize-none text-sm"
                placeholder={t('promptPlaceholder')}
              />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !prompt.trim()}
                  onClick={handleGhostWrite}
                >
                  {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  {t('ghostWrite')}
                </Button>
                <Button type="button" disabled={pending || !prompt.trim()} onClick={handleGenerate}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('generatingShort')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('generate')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getMessageTimeMs(ts: string) {
  const n = new Date(ts).getTime()
  return Number.isFinite(n) ? n : 0
}
