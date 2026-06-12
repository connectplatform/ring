'use client'

import { useState } from 'react'
import { Loader2, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'

export interface GenerateArticleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onArticleReady: (result: {
    articleId: string
    title?: string
    locale?: string
    featuredImage?: string
    audioUrl?: string
  }) => void
}

interface GenerateArticleApiResponse {
  success: boolean
  error?: string
  articleId?: string
  title?: string
  locale?: string
  featuredImage?: string
  audioUrl?: string
}

export function GenerateArticleDialog({
  open,
  onOpenChange,
  onArticleReady,
}: GenerateArticleDialogProps) {
  const [source, setSource] = useState<'url' | 'search' | 'text'>('url')
  const [value, setValue] = useState('')
  const [instruction, setInstruction] = useState('')
  const [enableAudio, setEnableAudio] = useState(true)
  const [enableImage, setEnableImage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!value.trim()) {
      setError('Enter a URL, search query, or source text')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          value: value.trim(),
          instruction: instruction.trim() || undefined,
          enableAudio,
          enableImage,
        }),
      })

      const data = (await response.json()) as GenerateArticleApiResponse
      if (!response.ok || !data.success || !data.articleId) {
        throw new Error(data.error || 'Article generation failed')
      }

      onArticleReady({
        articleId: data.articleId,
        title: data.title,
        locale: data.locale,
        featuredImage: data.featuredImage,
        audioUrl: data.audioUrl,
      })
      onOpenChange(false)
      setValue('')
      setInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Article generation failed')
    } finally {
      setLoading(false)
    }
  }

  const valueLabel =
    source === 'url' ? 'URL' : source === 'search' ? 'Search query' : 'Source text'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Generate news article
          </DialogTitle>
          <DialogDescription>
            Grok researches the web, writes a cited draft with category and tags, generates a featured image and optional narration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Source type</Label>
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="search">Web search</SelectItem>
                <SelectItem value="text">Raw text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{valueLabel}</Label>
            {source === 'text' ? (
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Paste briefing notes or raw copy..."
                rows={4}
              />
            ) : (
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={source === 'url' ? 'https://...' : 'Ring Platform partnership announcement'}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Editorial instruction (optional)</Label>
            <Input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Tone, angle, audience..."
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="enable-image">Featured image</Label>
            <Switch id="enable-image" checked={enableImage} onCheckedChange={setEnableImage} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-audio">Audio narration</Label>
            <Switch id="enable-audio" checked={enableAudio} onCheckedChange={setEnableAudio} />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Researching...
              </>
            ) : (
              'Generate draft'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
