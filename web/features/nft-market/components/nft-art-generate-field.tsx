'use client'

/**
 * Inline ImageConductor field for member NFT create flow.
 * Reuses the 4-variation + select pattern from GateArtPreviewModal,
 * persisted via ImageConductor → file() → RingFileBase.
 */

import { useState, useTransition } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { previewMemberNftArtAction } from '@/app/_actions/nft-member'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type PreviewImage = { url: string; recordId?: string }

export function NftArtGenerateField({
  name = 'imageUri',
  label = 'Describe your NFT in full detail',
  purpose = 'nft-member-preview',
  required = false,
  initialPrompt = '',
}: {
  name?: string
  label?: string
  purpose?: string
  required?: boolean
  initialPrompt?: string
}) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [previews, setPreviews] = useState<PreviewImage[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selected = previews[selectedIdx]

  function handleGenerate() {
    const text = prompt.trim()
    if (!text) {
      setError('Describe your NFT in full detail to generate art')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await previewMemberNftArtAction({ prompt: text, purpose })
      if (!result.success || !result.images?.length) {
        setError(result.error || 'Failed to generate previews')
        setPreviews([])
        return
      }
      setPreviews(result.images)
      setSelectedIdx(0)
    })
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="space-y-2">
        <Label htmlFor={`${name}-prompt`}>{label}</Label>
        <Textarea
          id={`${name}-prompt`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={pending}
          placeholder="Subject, style, colors, mood, composition — the more detail, the better the four previews…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={pending || !prompt.trim()} onClick={handleGenerate}>
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
        {selected?.url ? (
          <p className="text-xs text-muted-foreground">Selected preview will be used as cover art.</p>
        ) : required ? (
          <p className="text-xs text-muted-foreground">Generate and select a cover before creating.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Optional — generate cover art with ImageConductor.</p>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {pending && previews.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Generating 4 preview variations…</p>
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {previews.map((img, idx) => (
            <button
              key={img.recordId ?? img.url}
              type="button"
              disabled={pending}
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all',
                selectedIdx === idx
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-primary/50',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Variation ${idx + 1}`} className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium">
                {idx + 1}
                {selectedIdx === idx ? ' · selected' : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <input type="hidden" name={name} value={selected?.url || ''} />
    </div>
  )
}
