'use client'

import { Headphones, Video } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

type DocsArticleMediaActionsProps = {
  slug: string[]
  title: string
}

/** Narration / video — backlog UI; hooks reserved for AudioConductor + doc video pipeline. */
export function DocsArticleMediaActions({ slug, title }: DocsArticleMediaActionsProps) {
  const t = useTranslations('docs.article')

  const handleNarration = () => {
    toast({
      title: t('playNarration'),
      description: t('narrationComingSoon'),
    })
  }

  const handleVideo = () => {
    toast({
      title: t('watchVideo'),
      description: t('videoComingSoon'),
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={handleNarration}
        aria-label={t('playNarration')}
        data-doc-slug={slug.join('/')}
        data-doc-title={title}
      >
        <Headphones className="h-3.5 w-3.5" aria-hidden />
        {t('playNarration')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={handleVideo}
        aria-label={t('watchVideo')}
      >
        <Video className="h-3.5 w-3.5" aria-hidden />
        {t('watchVideo')}
      </Button>
    </div>
  )
}
