'use client'

import { useCallback, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { appendReferralFragment } from '@/features/refcodes/lib/referral-share-url'

type ShareEarnWidgetProps = {
  username?: string | null
  className?: string
}

/**
 * Share & Earn overview widget — links to /refcodes + copies current page URL with #username.
 * Personal-page public URL copy lives on PersonalPageWidget.
 */
export function ShareEarnWidget({ username, className }: ShareEarnWidgetProps) {
  const locale = useLocale() as Locale
  const t = useTranslations('modules.profile')
  const tNav = useTranslations('navigation')
  const [copied, setCopied] = useState(false)

  const copyPageWithTag = useCallback(async () => {
    if (!username || typeof window === 'undefined') return
    try {
      const tagged = appendReferralFragment(window.location.href, username)
      await navigator.clipboard.writeText(tagged)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [username])

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
            {t('shareEarnWidgetHint') ||
              'Share pages with your #username tag and earn credits'}
          </p>
        </div>
      </Link>

      {!username ? (
        <p className="border-t border-border/40 pt-3 text-xs text-muted-foreground">
          {t('shareEarnNeedUsername') ||
            'Set a username to share pages with your referral tag.'}
        </p>
      ) : (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {t('shareEarnCopyPageHint') ||
              'Copy the current page URL with your #username referral tag.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5 sm:w-auto"
            onClick={() => void copyPageWithTag()}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied
              ? t('shareEarnCopied') || 'Copied'
              : t('shareEarnCopyPage') || 'Copy page + tag'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default ShareEarnWidget
