'use client'

/**
 * Fullscreen art preview modal (fs-modal pattern) for admin NFT gate mint.
 * Generates 4 variations; selected image becomes official mint URI.
 */

import { useCallback, useEffect, useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { adminActivateGateTemplateAction, previewGateArtAction } from '@/app/_actions/nft-gates'
import type { NftGateTemplate } from '@/lib/ring-config-types'

export interface GateArtPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: NftGateTemplate | null
  priceRing?: number
  onMinted?: (result: {
    activeTemplateAsset?: string
    imageUri?: string
    slug: string
  }) => void
}

type PreviewImage = { url: string; recordId?: string }

export function GateArtPreviewModal({
  open,
  onOpenChange,
  template,
  priceRing,
  onMinted,
}: GateArtPreviewModalProps) {
  const [promptOpen, setPromptOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [previews, setPreviews] = useState<PreviewImage[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewPending, startPreview] = useTransition()
  const [mintPending, startMint] = useTransition()

  const loadPreviews = useCallback(
    (promptText: string) => {
      if (!template) return
      setError(null)
      startPreview(async () => {
        const result = await previewGateArtAction({
          slug: template.slug,
          prompt: promptText,
        })
        if (!result.success || !result.images?.length) {
          setError(result.error || 'Failed to generate previews')
          setPreviews([])
          return
        }
        setPreviews(result.images)
        setSelectedIdx(0)
      })
    },
    [template],
  )

  useEffect(() => {
    if (!open || !template) return
    setPrompt(template.imagePrompt)
    setPromptOpen(false)
    setPreviews([])
    setSelectedIdx(0)
    setError(null)
    loadPreviews(template.imagePrompt)
  }, [open, template, loadPreviews])

  function handleRegenerate() {
    loadPreviews(prompt)
  }

  function handleMintSelected() {
    if (!template || previews.length === 0) return
    const selected = previews[selectedIdx]
    if (!selected?.url) return

    setError(null)
    startMint(async () => {
      const result = await adminActivateGateTemplateAction({
        slug: template.slug,
        priceRing,
        regenerateArt: false,
        imageUri: selected.url,
      })
      if (!result.success) {
        setError(result.error || 'Mint failed')
        return
      }
      onMinted?.({
        activeTemplateAsset: result.activeTemplateAsset,
        imageUri: result.imageUri,
        slug: template.slug,
      })
      onOpenChange(false)
    })
  }

  const busy = previewPending || mintPending
  const selected = previews[selectedIdx]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex h-[min(92vh,900px)] w-[min(96vw,1100px)] max-w-none translate-x-[-50%] translate-y-[-50%]',
          'flex-col gap-0 overflow-hidden p-0 sm:rounded-xl',
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>
            {template ? `Preview art — ${template.name}` : 'Preview gate art'}
          </DialogTitle>
          <DialogDescription>
            Pick one of four variations. Regenerate until satisfied, then mint with selected art.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {previewPending && previews.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Generating 4 preview variations…</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {previews.map((img, idx) => (
                  <button
                    key={img.recordId ?? img.url}
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedIdx(idx)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all',
                      selectedIdx === idx
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`Variation ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">
                      {idx + 1}
                      {selectedIdx === idx ? ' · selected' : ''}
                    </span>
                  </button>
                ))}
                {previewPending &&
                  previews.length > 0 &&
                  Array.from({ length: Math.max(0, 4 - previews.length) }).map((_, i) => (
                    <div
                      key={`loading-${i}`}
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed bg-muted/50"
                    >
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ))}
              </div>
            )}
          </div>

          <Collapsible
            open={promptOpen}
            onOpenChange={setPromptOpen}
            className="shrink-0 border-t"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3 text-left text-sm font-medium hover:bg-muted/50">
              Generation prompt
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform',
                  promptOpen && 'rotate-180',
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex max-h-[min(28vh,240px)] min-h-0 flex-col border-t px-6 pb-4 data-[state=open]:flex">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy}
                className="min-h-[120px] flex-1 resize-none font-mono text-sm"
                placeholder="Image generation prompt for this gate NFT…"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Edits apply to Regenerate only (not saved to ring-config).
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="shrink-0 flex-row justify-between gap-2 border-t px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !template}
            onClick={handleRegenerate}
          >
            {previewPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              'Regenerate'
            )}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !selected?.url || !template}
              onClick={handleMintSelected}
            >
              {mintPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Minting…
                </>
              ) : (
                'Mint with selected art'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
