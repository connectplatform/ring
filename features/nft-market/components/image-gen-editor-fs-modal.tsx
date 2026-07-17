'use client'

/**
 * Fullscreen ImageConductor editor (fs-modal).
 * Desktop/iPad: preview left + message history right.
 * Mobile: split preview top / caption+history bottom; one-line expanding input.
 * Messages via /messages (product-tool chat key imggen:page:field).
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import {
  listNftImageGenMessagesAction,
  runNftImageGenEditorAction,
} from '@/app/_actions/nft-member'
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
import { cn } from '@/lib/utils'
import { IMAGE_CONDUCTOR_SENDER_ID } from '@/features/nft-market/media-types'

type HistoryMessage = {
  id: string
  senderId: string
  senderName: string
  content: string
  type: string
  timestamp: string
  attachments?: Array<{ url: string; name: string; type: string }>
}

type PreviewImage = { url: string; recordId?: string }

export function ImageGenEditorFsModal({
  open,
  onOpenChange,
  pageSlug,
  fieldId,
  purpose,
  onUseImage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageSlug: string
  fieldId: string
  purpose?: string
  onUseImage: (url: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [previews, setPreviews] = useState<PreviewImage[]>([])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [messages, setMessages] = useState<HistoryMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [modalFocused, setModalFocused] = useState(true)

  const selected = previews[previewIdx]
  const lineCount = Math.min(6, Math.max(1, prompt.split('\n').length + (prompt.length > 72 ? 1 : 0)))

  const loadHistory = useCallback(() => {
    startTransition(async () => {
      const result = await listNftImageGenMessagesAction({ pageSlug, fieldId })
      if (!result.success) {
        setError(result.error || 'Failed to load history')
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
  }, [pageSlug, fieldId])

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
    () => messages.filter((m) => m.senderId !== IMAGE_CONDUCTOR_SENDER_ID && m.type !== 'system'),
    [messages],
  )

  function handleGenerate() {
    const text = prompt.trim()
    if (!text) {
      setError('Describe your NFT in full detail to generate art')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await runNftImageGenEditorAction({
        prompt: text,
        pageSlug,
        fieldId,
        purpose,
        notifyIfBackground: !modalFocused || document.visibilityState !== 'visible',
      })
      if (!result.success || !result.images?.length) {
        setError(result.error || 'Generation failed')
        await loadHistory()
        return
      }
      setPreviews(result.images)
      setPreviewIdx(0)
      setPrompt('')
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
          <DialogTitle>Generate NFT art</DialogTitle>
          <DialogDescription>
            Describe your NFT in full detail. Swipe variations, then use the selected image.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Preview pane */}
          <div className="relative flex min-h-0 flex-[1] flex-col border-b md:w-1/2 md:border-b-0 md:border-r">
            <div className="relative min-h-0 flex-1 bg-muted/40">
              {pending && previews.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Generating 4 preview variations…</p>
                </div>
              ) : selected?.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.url}
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
                  <p className="text-sm font-medium text-foreground">Describe your NFT in full detail</p>
                  <p className="max-w-sm text-xs">
                    Subject, style, colors, mood, and composition. Generate four variations, swipe to
                    compare, then use the best one as cover art.
                  </p>
                </div>
              )}
            </div>

            {/* Mobile caption under image */}
            {currentUserCaption && selected?.url ? (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground md:hidden">
                <p className="line-clamp-3">{currentUserCaption}</p>
              </div>
            ) : null}

            {/* Desktop Use this image under preview */}
            <div className="hidden border-t p-3 md:block">
              <Button
                type="button"
                className="w-full"
                disabled={!selected?.url || pending}
                onClick={() => {
                  if (!selected?.url) return
                  onUseImage(selected.url)
                  onOpenChange(false)
                }}
              >
                Use this image
              </Button>
            </div>
          </div>

          {/* Mobile Use this image overlay at pane separator */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 md:hidden">
            <Button
              type="button"
              size="sm"
              className="pointer-events-auto shadow-lg"
              disabled={!selected?.url || pending}
              onClick={() => {
                if (!selected?.url) return
                onUseImage(selected.url)
                onOpenChange(false)
              }}
            >
              Use this image
            </Button>
          </div>

          {/* History + composer */}
          <div className="flex min-h-0 flex-[1] flex-col md:w-1/2">
            {error ? (
              <Alert variant="destructive" className="m-3 mb-0">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 md:px-4">
              {userTurns.length === 0 && !pending ? (
                <p className="text-sm text-muted-foreground">
                  Your generation prompts will appear here with time-ago stamps.
                </p>
              ) : null}
              {userTurns.map((msg) => {
                const agent = messages.find(
                  (m) =>
                    m.senderId === IMAGE_CONDUCTOR_SENDER_ID &&
                    getMessageTimeMs(m.timestamp) >= getMessageTimeMs(msg.timestamp),
                )
                const thumb = agent?.attachments?.[0]?.url
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
                        <span className="text-xs font-medium">You</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="shrink-0 border-t p-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={pending}
                rows={lineCount}
                className="resize-none text-sm"
                placeholder="Describe your NFT in full detail…"
              />
              <div className="mt-2 flex justify-end">
                <Button type="button" disabled={pending || !prompt.trim()} onClick={handleGenerate}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
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
