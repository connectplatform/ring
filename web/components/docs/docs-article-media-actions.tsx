'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Headphones, Camera, Loader2, Copy, Bot, Sparkles, FileText } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import {
  createOrGetDocAgentNodus,
  ensureDocMediaBackground,
  generateDocNarration,
  generateDocWalkthrough,
  getDocMediaStatus,
} from '@/app/_actions/docs-media'
import type { DocsArticleMediaStatus, MediaReadyState } from '@/lib/docs/docs-media-types'
import { cn } from '@/lib/utils'

type DocsArticleMediaActionsProps = {
  slug: string[]
  title: string
  initialStatus?: DocsArticleMediaStatus | null
  /** Locale-aware path to `.md` twin (e.g. `/docs/foo.md`). */
  markdownHref?: string
}

function GeneratingLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Loader2 className="h-3.5 w-3.5 animate-[spin_2s_linear_infinite]" aria-hidden />
      {label}
    </span>
  )
}

/** Audible / Visual / Markdown / Agent — radio-host TTS, walkthrough, .md twin, NODUS copy. */
export function DocsArticleMediaActions({
  slug,
  title,
  initialStatus = null,
  markdownHref,
}: DocsArticleMediaActionsProps) {
  const t = useTranslations('docs.article')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<DocsArticleMediaStatus | null>(initialStatus)
  const [audioUrl, setAudioUrl] = useState<string | null>(initialStatus?.audioUrl ?? null)
  const [videoUrl, setVideoUrl] = useState<string | null>(initialStatus?.videoUrl ?? null)
  const [transcript, setTranscript] = useState<string | null>(initialStatus?.audibleText ?? null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [busy, setBusy] = useState<'audible' | 'visual' | 'agent' | null>(null)

  const refreshStatus = useCallback(async () => {
    const result = await getDocMediaStatus({ locale, slug })
    if (result.success && result.status) {
      setStatus(result.status)
      if (result.status.audioUrl) setAudioUrl(result.status.audioUrl)
      if (result.status.audibleText) setTranscript(result.status.audibleText)
    }
  }, [locale, slug])

  // Page-load: trust RSC `after()` first; poll status; delayed client fallback only if still missing.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    const boot = async () => {
      let current = status
      if (!current) {
        const result = await getDocMediaStatus({ locale, slug })
        if (cancelled) return
        if (result.success && result.status) {
          current = result.status
          setStatus(result.status)
          if (result.status.audioUrl) setAudioUrl(result.status.audioUrl)
          if (result.status.videoUrl) setVideoUrl(result.status.videoUrl)
          if (result.status.audibleText) setTranscript(result.status.audibleText)
        }
      }
      if (!current) return

      const needsPoll =
        current.audible === 'generating' ||
        current.agent === 'generating' ||
        current.visual === 'generating' ||
        current.shouldEnrich

      if (current.shouldEnrich) {
        // Give RSC after() ~5s before client also kicks enrichment (avoids double TTS)
        fallbackTimer = setTimeout(() => {
          if (cancelled) return
          void getDocMediaStatus({ locale, slug }).then((result) => {
            if (cancelled || !result.success || !result.status) return
            setStatus(result.status)
            if (result.status.shouldEnrich) {
              void ensureDocMediaBackground({ locale, slug, title })
            }
          })
        }, 5000)
      }

      if (!needsPoll) return

      timer = setInterval(async () => {
        if (cancelled) return
        const result = await getDocMediaStatus({ locale, slug })
        if (!result.success || !result.status) return
        setStatus(result.status)
        if (result.status.audioUrl) setAudioUrl(result.status.audioUrl)
        if (result.status.videoUrl) setVideoUrl(result.status.videoUrl)
        if (result.status.audibleText) setTranscript(result.status.audibleText)
        if (
          result.status.audible === 'ready' &&
          result.status.agent === 'ready' &&
          !result.status.shouldEnrich
        ) {
          if (timer) clearInterval(timer)
        }
      }, 2000)
    }

    void boot()
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per article
  }, [locale, slug.join('/'), title])

  const audibleState: MediaReadyState = busy === 'audible' ? 'generating' : status?.audible ?? 'missing'
  const agentState: MediaReadyState = busy === 'agent' ? 'generating' : status?.agent ?? 'missing'
  const visualState: MediaReadyState = busy === 'visual' ? 'generating' : status?.visual ?? 'missing'

  const handleAudible = () => {
    if (audibleState === 'ready' && audioUrl) {
      const el = document.querySelector<HTMLAudioElement>('[data-docs-audible-player]')
      el?.play().catch(() => undefined)
      return
    }
    setBusy('audible')
    startTransition(async () => {
      try {
        const result = await generateDocNarration({ locale, slug, title })
        if (!result.success || !result.audioUrl) {
          toast({
            title: t('audible'),
            description: result.error || t('narrationFailed'),
            variant: 'destructive',
          })
          return
        }
        setAudioUrl(result.audioUrl)
        if (result.summary) setTranscript(result.summary)
        if (result.status) setStatus(result.status)
        toast({
          title: t('audible'),
          description: result.cached ? t('narrationCached') : t('narrationReady'),
        })
      } catch (err) {
        toast({
          title: t('audible'),
          description: err instanceof Error ? err.message : t('narrationFailed'),
          variant: 'destructive',
        })
      } finally {
        setBusy(null)
        await refreshStatus()
      }
    })
  }

  const handleVisual = () => {
    if (visualState === 'ready' && videoUrl) {
      const el = document.querySelector<HTMLVideoElement>('[data-docs-visual-player]')
      el?.play().catch(() => undefined)
      return
    }
    setBusy('visual')
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
            title: t('visual'),
            description:
              result.code === 'MEMBER_REQUIRED' || result.code === 'AUTH_REQUIRED'
                ? t('videoMemberRequired')
                : result.error || t('videoFailed'),
            variant: 'destructive',
          })
          return
        }
        if (result.audioUrl) setAudioUrl(result.audioUrl)
        if (result.summary) setTranscript(result.summary)
        if (result.status) setStatus(result.status)
        if (result.videoUrl) {
          setVideoUrl(result.videoUrl)
          toast({ title: t('visual'), description: t('videoReady') })
        } else if (result.audioUrl) {
          toast({ title: t('visual'), description: t('narrationReady') })
        }
      } catch (err) {
        toast({
          title: t('visual'),
          description: err instanceof Error ? err.message : t('videoFailed'),
          variant: 'destructive',
        })
      } finally {
        setBusy(null)
      }
    })
  }

  const copyAgentPayload = async (json?: string, url?: string) => {
    const payload = json || url || status?.nodusUrl
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      toast({ title: t('agent'), description: t('agentCopied') })
    } catch {
      toast({
        title: t('agent'),
        description: t('agentCopyFailed'),
        variant: 'destructive',
      })
    }
  }

  const handleMarkdown = () => {
    const path =
      markdownHref ||
      (typeof window !== 'undefined'
        ? `${window.location.pathname.replace(/\/$/, '')}.md`
        : '')
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    void (async () => {
      try {
        await navigator.clipboard.writeText(url)
        toast({ title: t('markdown'), description: t('markdownCopied') })
      } catch {
        toast({
          title: t('markdown'),
          description: t('markdownCopyFailed'),
          variant: 'destructive',
        })
      }
    })()
  }

  const handleAgent = () => {
    if (agentState === 'ready') {
      void copyAgentPayload(
        status?.llmText ? JSON.stringify(status.llmText, null, 2) : undefined,
        typeof window !== 'undefined'
          ? `${window.location.origin}${status?.nodusUrl ?? ''}`
          : status?.nodusUrl,
      )
      return
    }

    setBusy('agent')
    startTransition(async () => {
      try {
        const result = await createOrGetDocAgentNodus({ locale, slug, title })
        if (!result.success) {
          toast({
            title: t('agentCreate'),
            description: result.error || t('agentFailed'),
            variant: 'destructive',
          })
          return
        }
        if (result.status) setStatus(result.status)
        await copyAgentPayload(
          result.llmJson,
          typeof window !== 'undefined'
            ? `${window.location.origin}${result.status?.nodusUrl ?? ''}`
            : result.status?.nodusUrl,
        )
      } catch (err) {
        toast({
          title: t('agentCreate'),
          description: err instanceof Error ? err.message : t('agentFailed'),
          variant: 'destructive',
        })
      } finally {
        setBusy(null)
        await refreshStatus()
      }
    })
  }

  const audibleDisabled = pending || audibleState === 'generating'
  const visualDisabled = pending || visualState === 'generating'
  const agentDisabled = pending || agentState === 'generating'

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleAudible}
          disabled={audibleDisabled}
          aria-label={t('audible')}
          data-doc-slug={slug.join('/')}
          data-doc-title={title}
        >
          {audibleState === 'generating' ? (
            <GeneratingLabel label={t('generating')} />
          ) : (
            <>
              <Headphones className="h-3.5 w-3.5" aria-hidden />
              {t('audible')}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleVisual}
          disabled={visualDisabled}
          aria-label={t('visual')}
        >
          {visualState === 'generating' ? (
            <GeneratingLabel label={t('generating')} />
          ) : (
            <>
              <Camera className="h-3.5 w-3.5" aria-hidden />
              {t('visual')}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleMarkdown}
          aria-label={t('markdown')}
          title={t('markdownHint')}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {t('markdown')}
          <Copy className="h-3 w-3 opacity-70" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('gap-1.5 text-xs', agentState === 'ready' && 'border-primary/40')}
          onClick={handleAgent}
          disabled={agentDisabled}
          aria-label={agentState === 'ready' ? t('agent') : t('agentCreate')}
        >
          {agentState === 'generating' ? (
            <GeneratingLabel label={t('generating')} />
          ) : agentState === 'ready' ? (
            <>
              <Bot className="h-3.5 w-3.5" aria-hidden />
              {t('agent')}
              <Copy className="h-3 w-3 opacity-70" aria-hidden />
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t('agentCreate')}
            </>
          )}
        </Button>
      </div>
      {audioUrl ? (
        <audio
          controls
          src={audioUrl}
          className="max-w-[220px] h-8"
          preload="none"
          data-docs-audible-player
        >
          <track kind="captions" />
        </audio>
      ) : null}
      {videoUrl ? (
        <video
          controls
          src={videoUrl}
          className="max-w-[280px] rounded-md"
          preload="metadata"
          data-docs-visual-player
        />
      ) : null}
      {transcript ? (
        <div className="max-w-[280px] text-right">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setShowTranscript((v) => !v)}
          >
            {showTranscript ? t('hideTranscript') : t('showTranscript')}
          </button>
          {showTranscript ? (
            <p className="mt-1 text-left text-xs leading-relaxed text-muted-foreground">
              {transcript}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
