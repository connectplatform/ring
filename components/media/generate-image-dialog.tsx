'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
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

export interface GenerateImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purpose?: string
  defaultAspectRatio?: string
  title?: string
  description?: string
  onImageReady: (url: string) => void
}

interface GenerateImageApiResponse {
  success: boolean
  error?: string
  images?: Array<{ url: string }>
}

export function GenerateImageDialog({
  open,
  onOpenChange,
  purpose = 'editor',
  defaultAspectRatio = '16:9',
  title = 'Generate image',
  description = 'Describe the image you want. It will be stored in ring-filebase and inserted into your content.',
  onImageReady,
}: GenerateImageDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [provider, setProvider] = useState<'xai' | 'google'>('xai')
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider,
          aspectRatio,
          purpose,
          n: 1,
        }),
      })

      const data = (await response.json()) as GenerateImageApiResponse
      if (!response.ok || !data.success || !data.images?.[0]?.url) {
        throw new Error(data.error || 'Image generation failed')
      }

      onImageReady(data.images[0].url)
      onOpenChange(false)
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="generate-image-prompt">Prompt</Label>
            <Textarea
              id="generate-image-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A vibrant editorial hero image about sustainable technology..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as 'xai' | 'google')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xai">xAI Grok Imagine</SelectItem>
                  <SelectItem value="google">Google Imagen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-image-aspect">Aspect ratio</Label>
              <Input
                id="generate-image-aspect"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                placeholder="16:9"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
