'use client'

import { useState, useTransition } from 'react'
import { Headphones, Video, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import {
  generateDocNarration,
  generateDocWalkthrough,
} from '@/app/_actions/docs-media'

type DocsArticleMediaActionsProps = {
  slug: string[]
  title: string
}

/** Narration / video — AudioConductor + MediaConductor (scripted walkthrough). */
export function DocsArticleMediaActions({ slug, title }: DocsArticleMediaActionsProps) {
  const t = useTranslations('docs.article')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'narration' | 'video' | null>(null)

  const handleNarration = () => {
    setBusy('narration')
    startTransition(async () => {
      try {
        const result = await generateDocNarration({ locale, slug, title })
        if (!result.success || !result.audioUrl) {
          toast({
            title: t('playNarration'),
            description: result.error || t('narrationFailed'),
            variant: 'destructive',
          })
          return
        }
        setAudioUrl(result.audioUrl)
        toast({
          title: t('playNarration'),
          description: result.cached ? t('narrationCached') : t('narrationReady'),
        })
      } finally {
        setBusy(null)
      }
    })
  }

  const handleVideo = () => {
    setBusy('video')
    startTransition(async () => {
      try {
        const result = await generateDocWalkthrough({
          locale,
          slug,
          title,
          enableVideo: true,
        })
        if (!result.success) {
          toast({
            title: t('watchVideo'),
            description:
              result.code === 'MEMBER_REQUIRED' || result.code === 'AUTH_REQUIRED'
                ? t('videoMemberRequired')
                : result.error || t('videoFailed'),
            variant: 'destructive',
          })
          return
        }
        if (result.audioUrl) setAudioUrl(result.audioUrl)
        if (result.videoUrl) {
          setVideoUrl(result.videoUrl)
          toast({
            title: t('watchVideo'),
            description: t('videoReady'),
          })
        } else if (result.audioUrl) {
          toast({
            title: t('watchVideo'),
            description: t('narrationReady'),
          })
        }
      } finally {
        setBusy(null)
      }
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleNarration}
          disabled={pending}
          aria-label={t('playNarration')}
          data-doc-slug={slug.join('/')}
          data-doc-title={title}
        >
          {busy === 'narration' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Headphones className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('playNarration')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleVideo}
          disabled={pending}
          aria-label={t('watchVideo')}
        >
          {busy === 'video' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Video className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('watchVideo')}
        </Button>
      </div>
      {audioUrl ? (
        <audio controls src={audioUrl} className="max-w-[220px] h-8" preload="none">
          <track kind="captions" />
        </audio>
      ) : null}
      {videoUrl ? (
        <video
          controls
          src={videoUrl}
          className="max-w-[280px] rounded-md"
          preload="metadata"
        />
      ) : null}
    </div>
  )
}
