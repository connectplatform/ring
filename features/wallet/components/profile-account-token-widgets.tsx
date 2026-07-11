'use client'

import { useTranslations } from 'next-intl'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { getClientCreditFiatCurrency } from '@/lib/ring-config-client'
import { DavinciGlassStatBlock } from '@/lib/ui/davinci'

/**
 * Profile widgets: membership subscription status + account spend limits.
 * Moved from /wallet — credits are fiat USD, limits shown in credit currency context.
 */
export default function ProfileAccountTokenWidgets() {
  const t = useTranslations('modules.wallet')
  const { subscription, limits, isLoading } = useCreditBalanceContext()
  const creditCurrency = getClientCreditFiatCurrency()

  if (isLoading && !subscription && !limits) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DavinciGlassStatBlock
        value={subscription?.active ? t('active') : t('inactive')}
        label={t('subscription')}
        hint={`${t('status')}: ${subscription?.active ? t('active') : t('inactive')}`}
        beamOnHover
      />
      <DavinciGlassStatBlock
        value={`${limits?.remaining_monthly_limit || '0'} ${creditCurrency}`}
        label={t('monthlyLimits')}
        hint={t('remaining')}
        beamOnHover
      />
    </div>
  )
}
