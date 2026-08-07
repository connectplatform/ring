'use client'

/**
 * Compact credit + native balance tiles for the profile hero.
 * Both tiles link to /wallet — labels use ring-config credit unit + main currency SSOT.
 */

import { Coins, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { usePrimaryNativeBalance } from '@/hooks/use-primary-native-balance'
import {
  getClientCreditUnitLabel,
  getClientMainCurrency,
  resolveCreditMainCurrencyEquivalent,
} from '@/lib/ring-config-client'
import { formatCreditPoints } from '@/lib/wallet/format-credit-points'
import { Link, toAppHref } from '@/i18n/routing'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

type ProfileHeroBalancesProps = {
  locale: string
  className?: string
}

const tileShell = cn(
  'flex w-full min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left sm:gap-3 sm:p-3',
  'border-[color-mix(in_oklch,var(--davinci-glass-border)_85%,transparent)]',
  'bg-[color-mix(in_oklch,var(--davinci-glass-bg)_75%,transparent)] backdrop-blur-sm',
)

const iconShell = cn(
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10',
)

export function ProfileHeroBalances({ locale, className }: ProfileHeroBalancesProps) {
  const t = useTranslations('modules.profile')
  const credit = useCreditBalanceContext()
  const creditUnit = getClientCreditUnitLabel()
  const mainCurrency = getClientMainCurrency()
  const {
    nativeTokenBalance,
    formatted: nativeFormatted,
    loading: nativeLoading,
    error: nativeError,
    symbol: nativeSymbol,
  } = usePrimaryNativeBalance({ enabled: true })

  const creditBalance = formatCreditPoints(credit?.balance?.amount ?? '0')
  const creditMainEquivalent = resolveCreditMainCurrencyEquivalent(
    credit?.balance?.amount,
    credit?.balance?.main_currency_equivalent,
  )
  const creditLoading = Boolean(credit?.isLoading && !credit?.balance)

  const loc = locale.toLowerCase() as Locale
  const walletHref = toAppHref(ROUTES.WALLET(loc))

  const nativeDisplay = (() => {
    if (nativeLoading && nativeTokenBalance === null) return null
    if (nativeError && nativeTokenBalance === null) return '—'
    return nativeFormatted
  })()

  return (
    <div className={cn('mt-5 grid grid-cols-2 gap-2 sm:gap-3', className)}>
      <Link
        href={walletHref}
        className={cn(
          tileShell,
          'border-primary/15 bg-primary/5',
          'transition-colors hover:brightness-[1.04]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        )}
        aria-label={t('rewardQuests.openWallet')}
      >
        <div className={cn(iconShell, 'bg-primary/10')}>
          <Coins className="h-4 w-4 text-primary sm:h-5 sm:w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
            {t('rewardQuests.userCredits')}
          </p>
          {creditLoading ? (
            <div className="mt-0.5 space-y-1.5">
              <Skeleton className="h-5 w-16 sm:h-6 sm:w-24" />
              <Skeleton className="h-3 w-12 sm:w-16" />
            </div>
          ) : (
            <>
              <p className="truncate text-base font-bold leading-tight sm:text-lg">
                {Number(creditBalance).toLocaleString()}{' '}
                <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">
                  {creditUnit}
                </span>
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {t('rewardQuests.approxFiat', {
                  amount: creditMainEquivalent,
                  currency: mainCurrency,
                })}
              </p>
            </>
          )}
        </div>
      </Link>

      <Link
        href={walletHref}
        className={cn(
          tileShell,
          'border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]',
          'bg-[color-mix(in_oklch,var(--davinci-beam)_8%,transparent)]',
          'transition-colors hover:brightness-[1.04]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--davinci-beam)]/40 focus-visible:ring-offset-2',
        )}
        aria-label={t('rewardQuests.openWallet')}
      >
        <div
          className={cn(
            iconShell,
            'bg-[color-mix(in_oklch,var(--davinci-beam)_16%,transparent)]',
          )}
        >
          <Wallet
            className="h-4 w-4 text-[var(--davinci-beam)] sm:h-5 sm:w-5"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
            {t('rewardQuests.nativeBalance', { symbol: nativeSymbol })}
          </p>
          {nativeDisplay === null ? (
            <Skeleton className="mt-0.5 h-5 w-14 sm:h-6 sm:w-20" />
          ) : (
            <p className="truncate text-base font-bold leading-tight sm:text-lg">
              {nativeDisplay}{' '}
              <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">
                {nativeSymbol}
              </span>
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
