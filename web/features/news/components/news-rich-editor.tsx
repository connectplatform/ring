'use client'

/**
 * News-only rich Markdown editor — WikiRichEditor core + news widget toolbar.
 * CV / wiki keep WikiRichEditor minimal; do not mount this shell there.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GenerateImageDialog } from '@/components/media/generate-image-dialog'
import { Film, ImageIcon, Link2, Music2, Users } from 'lucide-react'
import {
  buildEmbedShortcode,
  buildMoodShortcode,
  buildVideoShortcode,
} from '@/features/news/lib/news-shortcodes'
import {
  detectEmbedFromUrl,
  looksLikeLoneUrl,
} from '@/features/news/lib/editor-widget-detector'
import { useNewsMarkdownCollab } from '@/features/news/lib/use-news-markdown-collab'

const WikiRichEditor = dynamic(
  () =>
    import('@/features/wiki/components/wiki-rich-editor').then((m) => m.WikiRichEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
  },
)

function appendBlock(markdown: string, block: string): string {
  const base = markdown || ''
  if (!base.trim()) return block
  return `${base.replace(/\s+$/, '')}\n\n${block}\n`
}

export type NewsRichEditorProps = {
  value: string
  onChange: (markdown: string) => void
  articleId?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  selectionMemoryScope?: string
}

export function NewsRichEditor({
  value,
  onChange,
  articleId,
  placeholder,
  disabled,
  className,
  selectionMemoryScope,
}: NewsRichEditorProps) {
  const [moodOpen, setMoodOpen] = useState(false)
  const [playlistId, setPlaylistId] = useState('')
  const [generateOpen, setGenerateOpen] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const applyingCollab = useRef(false)

  const collab = useNewsMarkdownCollab(articleId, value, (remote) => {
    applyingCollab.current = true
    onChange(remote)
    queueMicrotask(() => {
      applyingCollab.current = false
    })
  })

  const emit = useCallback(
    (next: string) => {
      onChange(next)
      if (!applyingCollab.current) collab.pushMarkdown(next)
    },
    [collab, onChange],
  )

  useEffect(() => {
    if (!collab.enabled || applyingCollab.current) return
    collab.pushMarkdown(value)
  }, [value, collab])

  const insertShortcodeBlock = useCallback(
    (block: string) => {
      emit(appendBlock(valueRef.current, block))
    },
    [emit],
  )

  const hydrateEmbedOg = useCallback(
    (detectedUrl: string, bare: string, detected: ReturnType<typeof detectEmbedFromUrl>) => {
      void fetch('/api/news/embed-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: detectedUrl }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as {
            success?: boolean
            title?: string
            image?: string
          }
          if (!data.success || (!data.title && !data.image)) return
          const enriched = buildEmbedShortcode(detectedUrl, {
            title: data.title,
            image: data.image,
            provider: detected.provider,
            embedId: detected.embedId,
          })
          const current = valueRef.current
          if (current.includes(bare)) {
            emit(current.replace(bare, enriched))
          }
        })
        .catch(() => {})
    },
    [emit],
  )

  const onLoneUrlPaste = useCallback(
    (url: string): string | null => {
      if (!looksLikeLoneUrl(url)) return null
      const detected = detectEmbedFromUrl(url)
      const block = buildEmbedShortcode(detected.canonicalUrl || url, {
        provider: detected.provider,
        embedId: detected.embedId,
      })
      if (detected.previewMode === 'card') {
        hydrateEmbedOg(detected.canonicalUrl, block, detected)
      }
      return block
    },
    [hydrateEmbedOg],
  )

  const insertEmbedPrompt = () => {
    const url = window.prompt(
      'Paste embed URL (YouTube, Rumble, X, Facebook, Suno, or any link)',
    )
    if (!url?.trim()) return
    const detected = detectEmbedFromUrl(url.trim())
    const bare = buildEmbedShortcode(detected.canonicalUrl || url.trim(), {
      provider: detected.provider,
      embedId: detected.embedId,
    })
    insertShortcodeBlock(bare)
    if (detected.previewMode === 'card') {
      hydrateEmbedOg(detected.canonicalUrl, bare, detected)
    }
  }

  const insertMood = () => {
    if (!playlistId.trim()) return
    insertShortcodeBlock(buildMoodShortcode(playlistId.trim()))
    setPlaylistId('')
    setMoodOpen(false)
  }

  const insertVideoPrompt = () => {
    const url = window.prompt('Video URL (https://… direct media or CDN)')
    if (!url?.trim()) return
    const poster = window.prompt('Poster image URL (optional)') || undefined
    insertShortcodeBlock(
      buildVideoShortcode(url.trim(), poster ? { poster: poster.trim() } : undefined),
    )
  }

  const onGeneratedImage = (url: string) => {
    insertShortcodeBlock(`![Generated image](${url})`)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={insertEmbedPrompt}
        >
          <Link2 className="mr-1.5 h-3.5 w-3.5" />
          Embed URL
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setMoodOpen(true)}
        >
          <Music2 className="mr-1.5 h-3.5 w-3.5" />
          Mood
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={insertVideoPrompt}
        >
          <Film className="mr-1.5 h-3.5 w-3.5" />
          Video
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setGenerateOpen(true)}
        >
          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          Generate image
        </Button>
        {collab.enabled ? (
          <Badge variant={collab.connected ? 'default' : 'secondary'} className="gap-1 text-xs">
            <Users className="h-3 w-3" />
            {collab.connected ? 'Live collab' : 'Collab connecting…'}
          </Badge>
        ) : null}
        {collab.error ? (
          <span className="text-xs text-destructive">{collab.error}</span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a lone URL to insert an embed. Shortcodes: [[mood:ID]] · [[embed:URL]] · [[video:SRC]]
      </p>

      <WikiRichEditor
        value={value}
        onChange={emit}
        disabled={disabled}
        placeholder={placeholder}
        selectionMemoryScope={selectionMemoryScope}
        className={className}
        onLoneUrlPaste={onLoneUrlPaste}
        preserveNewsShortcodes
      />

      <GenerateImageDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        purpose={articleId ? `news-inline-${articleId}` : 'news-inline'}
        defaultAspectRatio="16:9"
        title="Generate inline image"
        onImageReady={onGeneratedImage}
      />

      <Dialog open={moodOpen} onOpenChange={setMoodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Mood Player</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Playlist ID"
            value={playlistId}
            onChange={(e) => setPlaylistId(e.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoodOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={insertMood} disabled={!playlistId.trim()}>
              Insert [[mood:]]
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
