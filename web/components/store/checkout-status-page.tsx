'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'
import { davinciBeamInnerSurface, davinciCtaPrimary, davinciGlassSurface } from '@/lib/ui/davinci'
import { CheckCircle, XCircle, AlertCircle, Clock, Loader2, RefreshCw } from 'lucide-react'

type CheckoutStatus = 'success' | 'failure' | 'cancel' | 'error' | 'pending' | 'processing' | 'complete'

interface CheckoutStatusPageProps {
  status: CheckoutStatus
  locale: Locale
  orderId?: string
}

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-12 sm:py-14 lg:py-16'

const STATUS_CONFIG = {
  success: { icon: CheckCircle, iconColor: 'text-emerald-500' },
  complete: { icon: CheckCircle, iconColor: 'text-emerald-500' },
  failure: { icon: XCircle, iconColor: 'text-red-500' },
  error: { icon: XCircle, iconColor: 'text-red-500' },
  cancel: { icon: AlertCircle, iconColor: 'text-orange-500' },
  pending: { icon: Clock, iconColor: 'text-sky-500' },
  processing: { icon: Loader2, iconColor: 'text-sky-500' },
} as const

export default function CheckoutStatusPage({ status, locale, orderId }: CheckoutStatusPageProps) {
  const t = useTranslations('modules.store.checkout.status')
  const tCart = useTranslations('modules.store.cart')

  const config = STATUS_CONFIG[status]
  const IconComponent = config.icon
  const iconClassName = status === 'processing' ? `${config.iconColor} animate-spin` : config.iconColor

  const primaryClass = cn(
    davinciCtaPrimary,
    'flex w-full items-center justify-center rounded-[99px] px-6 py-3 text-center text-sm font-semibold sm:text-base',
  )
  const secondaryClass =
    'flex w-full items-center justify-center rounded-[99px] border border-[var(--davinci-glass-border)] bg-[var(--davinci-surface-bg)] px-6 py-3 text-center text-sm font-medium text-foreground transition-colors hover:border-[color-mix(in_oklch,var(--davinci-beam)_40%,transparent)]'

  return (
    <div className="w-full min-w-0">
      <section className={cn(BAND_Y, 'bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]')}>
        <div className={cn('mx-auto max-w-xl', INSET)}>
          <div className={cn(davinciGlassSurface, 'p-6 text-center sm:p-8')}>
            <div className="mb-5 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]">
                <IconComponent size={36} className={iconClassName} />
              </div>
            </div>

            <h1 className="mb-3 text-3xl font-semibold text-foreground sm:text-4xl">
              {t(`${status}.title`)}
            </h1>
            <p className="mb-6 text-muted-foreground">{t(`${status}.description`)}</p>

            {orderId ? (
              <div className={cn(davinciBeamInnerSurface, 'mb-6 px-4 py-3')}>
                <p className="mb-1 text-sm text-muted-foreground">{t('orderId')}</p>
                <p className="font-mono text-lg font-medium tabular-nums text-foreground">{orderId}</p>
              </div>
            ) : null}

            {status === 'pending' ? (
              <div className={cn(davinciBeamInnerSurface, 'mb-6 flex items-center justify-center gap-2 px-4 py-3 text-sky-600')}>
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t('pending.waitMessage')}</span>
              </div>
            ) : null}

            {status === 'processing' ? (
              <div className={cn(davinciBeamInnerSurface, 'mb-6 px-4 py-3')}>
                <p className="text-sm text-sky-600">{t('processing.timeEstimate')}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              {(status === 'success' || status === 'complete') && (
                <>
                  <Link href={ROUTES.STORE_ORDERS(locale)} className={primaryClass}>
                    {t('actions.viewOrder')}
                  </Link>
                  <Link href={ROUTES.STORE(locale)} className={secondaryClass}>
                    {tCart('continueShopping')}
                  </Link>
                </>
              )}

              {(status === 'failure' || status === 'error') && (
                <>
                  <Link href={ROUTES.CART(locale)} className={primaryClass}>
                    {t('actions.tryAgain')}
                  </Link>
                  <Link href={ROUTES.STORE(locale)} className={secondaryClass}>
                    {tCart('continueShopping')}
                  </Link>
                </>
              )}

              {status === 'cancel' && (
                <>
                  <Link href={ROUTES.CART(locale)} className={primaryClass}>
                    {tCart('backToCart')}
                  </Link>
                  <Link href={ROUTES.STORE(locale)} className={secondaryClass}>
                    {tCart('continueShopping')}
                  </Link>
                </>
              )}

              {(status === 'pending' || status === 'processing') && (
                <>
                  {orderId ? (
                    <Link href={ROUTES.STORE_ORDER_DETAILS(locale, orderId)} className={primaryClass}>
                      {t('actions.checkStatus')}
                    </Link>
                  ) : null}
                  <Link href={ROUTES.STORE(locale)} className={secondaryClass}>
                    {tCart('continueShopping')}
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href={ROUTES.CONTACT(locale)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('needHelp')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
