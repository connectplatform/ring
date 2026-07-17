'use client'

/**
 * Shared left-rail / mobile-menu legal footer — two rows:
 * 1. Privacy | Contact
 * 2. [tunnel] $version | $publisher
 */

import React from 'react'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import packageInfo from '@/package.json'
import { TunnelIndicatorCompact } from '@/components/navigation/tunnel-indicator'

export interface NavLegalFooterProps {
  className?: string
  /** Slightly larger type/spacing for mobile project menu */
  density?: 'compact' | 'comfortable'
  /** Center-align rows (mobile middle column) */
  align?: 'start' | 'center'
}

export function NavLegalFooter({
  className,
  density = 'compact',
  align = 'start',
}: NavLegalFooterProps) {
  const t = useTranslations('navigation')
  const textSize = density === 'comfortable' ? 'text-xs' : 'text-[10px]'
  const gap = density === 'comfortable' ? 'gap-1.5' : 'gap-1'
  const rowAlign = align === 'center' ? 'justify-center text-center' : 'justify-start text-left'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col leading-none text-muted-foreground',
        density === 'comfortable' ? 'gap-1.5' : 'gap-1',
        textSize,
        className,
      )}
    >
      <div className={cn('flex shrink-0 items-center', gap, rowAlign)}>
        <Link href="/privacy" className="hover:underline">
          {t('privacy')}
        </Link>
        <span aria-hidden>|</span>
        <Link href="/contact" className="hover:underline">
          {t('contact')}
        </Link>
      </div>
      <div className={cn('flex min-w-0 items-center', gap, rowAlign)}>
        <TunnelIndicatorCompact />
        <Link href="/changelog" className="shrink-0 hover:underline">
          v{packageInfo.version}
        </Link>
        <span aria-hidden>|</span>
        <Link href="/about-publisher" className="min-w-0 truncate font-medium hover:underline">
          {t('sidebar.appPublisher')}
        </Link>
      </div>
    </div>
  )
}
