'use client'

import { Share2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

/** Quick-action card: Share & Earn (refcodes) for store right rail. */
export function StoreShareEarnCard({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const tNav = useTranslations('navigation')
  const tStore = useTranslations('modules.store')

  return (
    <Link
      href={toAppHref(ROUTES.REFCODES(locale))}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition-colors',
        'hover:border-primary/40 hover:bg-primary/5',
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Share2 className="size-5" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{tNav('refcodes')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tStore('shareEarnHint', {
            default: 'Invite others and earn referral rewards',
          })}
        </p>
      </div>
    </Link>
  )
}
