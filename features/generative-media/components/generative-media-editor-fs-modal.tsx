'use client'

/**
 * Fullscreen generative media editor — history + swipe + Ghost-write + Use + video Enlive.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Loader2, Paperclip, Sparkles, Wand2, X } from 'lucide-react'
import {
  listGenMediaMessagesAction,
  runGenMediaImageAction,
  startGenMediaVideoAction,
  pollGenMediaVideoJobAction,
  cancelGenMediaVideoJobAction,
  runGhostWriteAction,
} from '@/app/_actions/generative-media'
import { saveGeneratedMediaToDesktopAction } from '@/app/_actions/file-cabinet'
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
import { toast } from '@/hooks/use-toast'
import { fileToImageDataUri } from '@/lib/images/to-image-data-uri'
import { useMediaUseTarget } from '@/features/generative-media/media-use-target'
import {
  GHOST_WRITE_SENDER_ID,
  IMAGE_CONDUCTOR_SENDER_ID,
  VIDEO_CONDUCTOR_SENDER_ID,
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

type PreviewMedia = {
  url: string
  webpUrl?: string
  recordId?: string
  fileId?: string
  kind: 'image' | 'video'
  contentType?: string
}

/** Client-side guard before converting File → data URI (mirrors provider max). */
const MAX_ATTACH_BYTES = 20 * 1024 * 1024

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
  attachedFile: attachedFileProp,
  initialPrompt,
  initialMode,
  onUseImage,
  onUseVideo,
  onSaveToDesktop,
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
  attachedFile?: File | null
  initialPrompt?: string
  initialMode?: 'image' | 'video'
  /** Optional — GenerativeMediaField keeps required caller-side */
  onUseImage?: (item: GalleryItem) => void
  onUseVideo?: (item: GalleryItem) => void
  onSaveToDesktop?: (item: GalleryItem) => void | Promise<void>
}) {
  const t = useTranslations('modules.generativeMedia')
  const { activeTarget } = useMediaUseTarget()
  const [prompt, setPrompt] = useState('')
  const [previews, setPreviews] = useState<PreviewMedia[]>([])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [modalFocused, setModalFocused] = useState(true)
  const [genMode, setGenMode] = useState<'image' | 'video'>('image')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachPreviewUrl, setAttachPreviewUrl] = useState<string | null>(null)
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [videoProgress, setVideoProgress] = useState<number | null>(null)
  const [videoStatus, setVideoStatus] = useState<string | null>(null)
  const [videoElapsedMs, setVideoElapsedMs] = useState(0)
  const videoPollAbortRef = useRef(false)
  const seededOpenRef = useRef(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const selected = previews[previewIdx]
  const lineCount = Math.min(6, Math.max(1, prompt.split('\n').length + (prompt.length > 72 ? 1 : 0)))
  const showSaveToDesktop = scope === 'cabinet' || Boolean(onSaveToDesktop)

  const clearAttachment = useCallback(() => {
    setAttachedFile(null)
    setAttachPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const setAttachment = useCallback((file: File | null) => {
    setAttachPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (!file || !file.type.startsWith('image/')) {
      setAttachedFile(null)
      return
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setError(t('attachTooLarge'))
      setAttachedFile(null)
      return
    }
    setError(null)
    setAttachedFile(file)
    setAttachPreviewUrl(URL.createObjectURL(file))
  }, [t])

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
        .find(
          (m) =>
            (m.senderId === IMAGE_CONDUCTOR_SENDER_ID || m.senderId === VIDEO_CONDUCTOR_SENDER_ID) &&
            m.attachments?.length,
        )
      if (lastAgent?.attachments?.length) {
        const isVideo = lastAgent.senderId === VIDEO_CONDUCTOR_SENDER_ID
        setPreviews(
          lastAgent.attachments.map((a) => ({
            url: a.url,
            kind: isVideo ? ('video' as const) : ('image' as const),
            contentType: isVideo ? 'video/mp4' : 'image/png',
          })),
        )
        setPreviewIdx(0)
      }
    })
  }, [scope, pageSlug, fieldId, entityId, t])

  useEffect(() => {
    if (!open) {
      seededOpenRef.current = false
      videoPollAbortRef.current = true
      setVideoJobId(null)
      setVideoProgress(null)
      setVideoStatus(null)
      clearAttachment()
      return
    }
    setError(null)
    setModalFocused(true)
    if (!seededOpenRef.current) {
      seededOpenRef.current = true
      if (initialPrompt != null) setPrompt(initialPrompt)
      if (initialMode) setGenMode(initialMode)
      if (attachedFileProp) setAttachment(attachedFileProp)
    }
    loadHistory()
  }, [
    open,
    loadHistory,
    initialPrompt,
    initialMode,
    attachedFileProp,
    setAttachment,
    clearAttachment,
  ])

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

  useEffect(() => {
    return () => {
      if (attachPreviewUrl) URL.revokeObjectURL(attachPreviewUrl)
    }
  }, [attachPreviewUrl])

  const userTurns = useMemo(
    () =>
      messages.filter(
        (m) =>
          m.senderId !== IMAGE_CONDUCTOR_SENDER_ID &&
          m.senderId !== VIDEO_CONDUCTOR_SENDER_ID &&
          m.senderId !== GHOST_WRITE_SENDER_ID &&
          m.type !== 'system',
      ),
    [messages],
  )

  async function resolveReferenceUrls(): Promise<string[] | undefined> {
    if (attachedFile) {
      const dataUri = await fileToImageDataUri(attachedFile)
      return [dataUri]
    }
    if (referenceImageUrl) return [referenceImageUrl]
    return undefined
  }

  function galleryItemFromSelected(sel: PreviewMedia): GalleryItem {
    return {
      id: sel.recordId || `gen_${Date.now()}`,
      originalUrl: sel.url,
      webpUrl: sel.webpUrl,
      contentType: sel.contentType || (sel.kind === 'video' ? 'video/mp4' : 'image/png'),
      source: sel.kind === 'video' ? 'video' : 'generated',
      enabled: true,
      isPrimary: true,
      fileId: sel.fileId,
      createdAt: new Date().toISOString(),
    }
  }

  function handleUse() {
    if (!selected?.url) return
    const item = galleryItemFromSelected(selected)
    if (selected.kind === 'video') {
      if (onUseVideo) {
        onUseVideo(item)
        onOpenChange(false)
        return
      }
      if (activeTarget) {
        activeTarget.replace({
          kind: 'video',
          url: item.originalUrl,
          fileId: item.fileId,
          alt: item.id,
        })
        onOpenChange(false)
        return
      }
      toast({ title: t('noUseTarget'), variant: 'destructive' })
      return
    }
    if (onUseImage) {
      onUseImage(item)
      onOpenChange(false)
      return
    }
    if (activeTarget) {
      activeTarget.replace({
        kind: 'image',
        url: item.originalUrl,
        webpUrl: item.webpUrl,
        fileId: item.fileId,
        alt: item.id,
      })
      onOpenChange(false)
      return
    }
    toast({ title: t('noUseTarget'), variant: 'destructive' })
  }

  function handleSaveToDesktop() {
    if (!selected?.url) return
    const item = galleryItemFromSelected(selected)
    startTransition(async () => {
      try {
        if (onSaveToDesktop) {
          await Promise.resolve(onSaveToDesktop(item))
        } else {
          await saveGeneratedMediaToDesktopAction({
            url: item.originalUrl,
            name:
              item.source === 'video'
                ? `enlive-${Date.now()}.mp4`
                : `enhance-${Date.now()}.png`,
            mime: item.contentType,
            fileId: item.fileId,
            parentId: null,
            addDesktopIcon: true,
          })
        }
        toast({ title: t('savedToDesktop') })
      } catch (err) {
        setError(err instanceof Error ? err.message : t('saveDesktopFailed'))
      }
    })
  }

  function handleGenerate() {
    const text = prompt.trim()
    if (!text) {
      setError(t('emptyTitle'))
      return
    }
    if (genMode === 'video' && !attachedFile && !referenceImageUrl) {
      setError(t('videoNeedsReference'))
      return
    }
    setError(null)
    startTransition(async () => {
      const refs = await resolveReferenceUrls()
      const notifyIfBackground = !modalFocused || document.visibilityState !== 'visible'

      if (genMode === 'video') {
        videoPollAbortRef.current = false
        setVideoProgress(0)
        setVideoStatus('pending')
        setVideoElapsedMs(0)

        const started = await startGenMediaVideoAction({
          scope,
          pageSlug,
          fieldId,
          entityId,
          prompt: text,
          purpose,
          actionUrl,
          imageUrl: refs?.[0],
          referenceImageUrls: refs,
          notifyIfBackground,
        })
        if (!started.success || !started.jobId) {
          setError(started.error || t('generateFailed'))
          setVideoJobId(null)
          setVideoProgress(null)
          setVideoStatus(null)
          await loadHistory()
          return
        }

        setVideoJobId(started.jobId)
        const intervalMs = started.pollIntervalMs || 5000

        while (!videoPollAbortRef.current) {
          await new Promise((r) => setTimeout(r, intervalMs))
          if (videoPollAbortRef.current) break

          const polled = await pollGenMediaVideoJobAction({ jobId: started.jobId })
          if (typeof polled.progress === 'number') setVideoProgress(polled.progress)
          if (typeof polled.elapsedMs === 'number') setVideoElapsedMs(polled.elapsedMs)
          if (polled.status) setVideoStatus(String(polled.status))

          if (polled.status === 'cancelled') {
            setError(t('videoCancelled'))
            setVideoJobId(null)
            await loadHistory()
            return
          }
          if (polled.status === 'done' && polled.video?.url) {
            setPreviews([
              {
                url: polled.video.url,
                recordId: polled.video.recordId,
                fileId: polled.video.fileId,
                kind: 'video',
                contentType: 'video/mp4',
              },
            ])
            setPreviewIdx(0)
            setPrompt('')
            setVideoJobId(null)
            setVideoProgress(100)
            setVideoStatus('done')
            await loadHistory()
            return
          }
          if (
            polled.status === 'failed' ||
            polled.status === 'expired' ||
            polled.success === false
          ) {
            setError(polled.error || t('generateFailed'))
            setVideoJobId(null)
            setVideoProgress(null)
            setVideoStatus(null)
            await loadHistory()
            return
          }
        }
        return
      }

      const result = await runGenMediaImageAction({
        scope,
        pageSlug,
        fieldId,
        entityId,
        prompt: text,
        purpose,
        actionUrl,
        referenceImageUrls: refs,
        notifyIfBackground,
      })
      if (!result.success || !result.images?.length) {
        setError(result.error || t('generateFailed'))
        await loadHistory()
        return
      }
      setPreviews(
        result.images.map((img) => ({
          url: img.url,
          webpUrl: img.webpUrl,
          recordId: img.recordId,
          kind: 'image' as const,
          contentType: 'image/png',
        })),
      )
      setPreviewIdx(0)
      setPrompt('')
      await loadHistory()
    })
  }

  function handleCancelVideo() {
    const jobId = videoJobId
    if (!jobId) return
    videoPollAbortRef.current = true
    startTransition(async () => {
      await cancelGenMediaVideoJobAction({ jobId })
      setVideoJobId(null)
      setVideoProgress(null)
      setVideoStatus('cancelled')
      setError(t('videoCancelled'))
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

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          setAttachment(file)
          return
        }
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file?.type.startsWith('image/')) setAttachment(file)
  }

  const currentUserCaption =
    userTurns.length > 0 ? userTurns[userTurns.length - 1]?.content : null

  const useLabel = selected?.kind === 'video' ? t('useThisVideo') : t('useThisImage')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex h-[min(94vh,920px)] w-[min(98vw,1200px)] max-w-none translate-x-[-50%] translate-y-[-50%]',
          'flex-col gap-0 overflow-hidden p-0 sm:rounded-xl',
        )}
        onPaste={onPaste}
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
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative flex min-h-0 flex-[1] flex-col border-b md:w-1/2 md:border-b-0 md:border-r">
            <div className="relative min-h-0 flex-1 bg-muted/40">
              {pending && previews.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">
                    {genMode === 'video' ? t('generatingVideo') : t('generating')}
                  </p>
                </div>
              ) : selected?.url ? (
                <>
                  {selected.kind === 'video' ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video
                      src={selected.url}
                      controls
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
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
                  )}
                  {selected.kind === 'image' && previews.length > 1 ? (
                    <>
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
                    </>
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

            <div className="hidden border-t p-3 md:flex md:flex-col md:gap-2">
              <Button
                type="button"
                className="w-full"
                disabled={!selected?.url || pending}
                onClick={handleUse}
              >
                {useLabel}
              </Button>
              {showSaveToDesktop ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!selected?.url || pending}
                  onClick={handleSaveToDesktop}
                >
                  {t('saveToDesktop')}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 md:hidden">
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="pointer-events-auto shadow-lg"
                disabled={!selected?.url || pending}
                onClick={handleUse}
              >
                {useLabel}
              </Button>
              {showSaveToDesktop ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="pointer-events-auto shadow-lg"
                  disabled={!selected?.url || pending}
                  onClick={handleSaveToDesktop}
                >
                  {t('saveToDesktop')}
                </Button>
              ) : null}
            </div>
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
                const agentMsg = messages.find(
                  (m) =>
                    (m.senderId === IMAGE_CONDUCTOR_SENDER_ID ||
                      m.senderId === VIDEO_CONDUCTOR_SENDER_ID) &&
                    getMessageTimeMs(m.timestamp) >= getMessageTimeMs(msg.timestamp),
                )
                const thumb = msg.attachments?.[0]?.url || agentMsg?.attachments?.[0]?.url
                const thumbIsVideo =
                  agentMsg?.senderId === VIDEO_CONDUCTOR_SENDER_ID ||
                  Boolean(agentMsg?.attachments?.[0]?.type === 'file')
                return (
                  <div key={msg.id} className="flex gap-3 rounded-lg border bg-card p-2">
                    <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted md:block">
                      {thumb ? (
                        thumbIsVideo ? (
                          // eslint-disable-next-line jsx-a11y/media-has-caption
                          <video
                            src={thumb}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        )
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
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {t('uploadNoCaption')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="shrink-0 border-t p-3">
              <div
                ref={dropZoneRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="mb-2"
              >
                {attachedFile || attachPreviewUrl || referenceImageUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {attachPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachPreviewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : referenceImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={referenceImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Paperclip className="m-3 h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {attachedFile?.name || t('referenceAttached')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {attachedFile
                          ? t('pasteHint')
                          : referenceImageUrl
                            ? t('editingWithReference')
                            : null}
                      </p>
                    </div>
                    {attachedFile ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={clearAttachment}
                        aria-label={t('clearAttachment')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('pasteOrDropHint')}</p>
                )}
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={pending}
                rows={lineCount}
                className="resize-none text-sm"
                placeholder={t('promptPlaceholder')}
              />
              {genMode === 'video' && (videoJobId || videoStatus === 'pending' || videoProgress != null) ? (
                <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {t('generatingVideoProgress')}
                    </span>
                    <span className="text-muted-foreground">
                      {t('videoStatus', { status: videoStatus || 'pending' })}
                      {typeof videoProgress === 'number'
                        ? ` · ${t('videoProgressPct', { pct: Math.round(videoProgress) })}`
                        : null}
                      {videoElapsedMs > 0
                        ? ` · ${Math.round(videoElapsedMs / 1000)}s`
                        : null}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, videoProgress ?? 0))}%`,
                      }}
                    />
                  </div>
                  {videoJobId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!videoJobId}
                      onClick={handleCancelVideo}
                    >
                      {t('cancelGeneration')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !prompt.trim() || genMode === 'video'}
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
                      {genMode === 'video' ? t('generatingVideo') : t('generatingShort')}
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
