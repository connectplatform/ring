'use client'

/**
 * @deprecated (2026-07-16) — Orphaned when profile wallet tab was removed.
 *
 * Historical use: mounted on /profile wallet tab above WalletSection.
 * Showed membership subscription status + monthly spend limits.
 *
 * Superseded on /wallet by WalletBalanceHero + credit context subscription
 * fields on CreditBalanceItemWidget / membership rails — not this widget.
 *
 * Stub monthly limits (always "1000") must NOT be shown until real policy
 * exists (credit-balance API + publishBalanceUpdate still emit stubs).
 * This component now only surfaces subscription status if remounted.
 */

import { useTranslations } from 'next-intl'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { DavinciGlassStatBlock } from '@/lib/ui/davinci'
import { Skeleton } from '@/components/ui/skeleton'

/** @deprecated See file header — prefer /wallet WalletBalanceHero. */
export default function ProfileAccountTokenWidgets() {
  const t = useTranslations('modules.wallet')
  const { subscription, isLoading } = useCreditBalanceContext()

  if (isLoading && !subscription) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
      <DavinciGlassStatBlock
        value={subscription?.active ? t('active') : t('inactive')}
        label={t('subscription')}
        hint={`${t('status')}: ${subscription?.active ? t('active') : t('inactive')}`}
        beamOnHover
      />
      {/* monthlyLimits tile removed — stub remaining_monthly_limit until spend policy SSOT */}
    </div>
  )
}
