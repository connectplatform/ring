'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type ShareEarnWidgetProps = {
  username?: string | null
  publicProfile?: boolean
  /** Active referral code for ?ref= attribution (optional). */
  refCode?: string | null
  className?: string
}

/** Share & Earn interactive widget — profile overview (refcodes + public URL copy). */
export function ShareEarnWidget({
  username,
  publicProfile = false,
  refCode,
  className,
}: ShareEarnWidgetProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.profile')
  const tNav = useTranslations('navigation')
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [resolvedRef, setResolvedRef] = useState<string | null>(refCode ?? null)

  useEffect(() => {
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  useEffect(() => {
    if (refCode) {
      setResolvedRef(refCode)
      return
    }
    let cancelled = false
    void fetch('/api/refcodes')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { codes?: Array<{ code?: string; active?: boolean }> } | null) => {
        if (cancelled || !data?.codes?.length) return
        const active = data.codes.find((c) => c.active !== false && c.code)
        if (active?.code) setResolvedRef(active.code)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [refCode])

  const profilePath = username ? ROUTES.PUBLIC_PROFILE(username, locale) : null
  const shareUrl =
    origin && profilePath
      ? `${origin}${profilePath}${resolvedRef ? `?ref=${encodeURIComponent(resolvedRef)}` : ''}`
      : ''

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [shareUrl])

  return (
    <div className={cn(davinciGlassSurface, 'flex flex-col gap-3 p-4', className)}>
      <Link
        href={toAppHref(ROUTES.REFCODES(locale))}
        className={cn(
          'flex items-start gap-3 transition-colors',
          'hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--davinci-beam)_16%,transparent)] text-[var(--davinci-beam)]">
          <Share2 className="size-5" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {t('shareEarnWidgetTitle') || tNav('refcodes') || 'Share & Earn'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('shareEarnWidgetHint') || 'Invite others and earn referral rewards'}
          </p>
        </div>
      </Link>

      {!username ? (
        <p className="border-t border-border/40 pt-3 text-xs text-muted-foreground">
          {t('shareEarnNeedUsername') ||
            'Set a username to share your personal page link.'}
        </p>
      ) : shareUrl ? (
        <div className="space-y-2 border-t border-border/40 pt-3">
          {!publicProfile ? (
            <p className="text-xs text-muted-foreground">
              {t('shareEarnPrivateHint') ||
                'Link opens a private page — enable Personal page to publish.'}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {shareUrl.replace(/^https?:\/\//, '')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => void copyShareUrl()}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied
                ? t('shareEarnCopied') || 'Copied'
                : t('shareEarnCopyProfile') || 'Copy link'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ShareEarnWidget
