'use client'

/**
 * /wallet page client — SSOT wealth surface for Ring.
 *
 * LEGACY RELOCATION (2026-07-16, profile wallet tab deprecated):
 * - features/wallet/components/wallet-section.tsx (@deprecated)
 *   Was embedded profile wallet (credits + subscription + stub limits + CTAs).
 *   Replaced here by WalletBalanceHero + contexts below.
 * - features/wallet/components/profile-account-token-widgets.tsx (@deprecated)
 *   Was subscription + stub monthlyLimits tiles on profile wallet tab.
 *   Subscription status still available via useCreditBalanceContext().subscription;
 *   stub limits must stay hidden until real spend policy exists.
 *
 * Prefer composing WalletBalanceHero / CreditBalanceItemWidget /
 * NativeWalletListItem / WalletTransactionFeed — do not remount the orphans.
 */

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { TrendingUp, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useCreditHistoryContext } from '@/components/providers/credit-history-provider'
import { useWalletListContext } from '@/components/providers/wallet-list-provider'
import { useWalletActivityContext } from '@/components/providers/wallet-activity-provider'
import { toast } from '@/hooks/use-toast'
import WalletTransactionFeed from '@/features/wallet/components/wallet-transaction-feed'
import { WalletBalanceHero } from '@/features/wallet/components/wallet-balance-hero'
import type { Locale } from '@/i18n/shared'
import { cn } from '@/lib/utils'

// TODO: Review useState usage for React 19 – consider useOptimistic/useActionState for actions/mutations.
// TODO: When React 19 is adopted, consider using useEffectEvent for stable async handlers
// TODO: With Next.js 16+, consider moving translations and fetches to server components where possible for optimal hydration

interface WalletPageClientProps {
  locale: Locale
  searchParams: Record<string, string | string[] | undefined>
  embedded?: boolean
}

// Main wallet client component rendered on the client side
export default function WalletPageClient({
  locale,
  embedded = false,
}: WalletPageClientProps) {
  // translations hook, scoping t() to 'modules.wallet'
  const t = useTranslations('modules.wallet')
  // State for copied wallet address, to detect and show copy-success UI/UX
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // Get token balance and loading/refresh state from context
  const {
    balance: tokenBalance,
    isLoading: balanceLoading,
    isRefreshing: isCreditRefreshing,
    error: balanceError,
    refresh: refetchBalance,
  } = useCreditBalanceContext()

  // Get refresh indicator for history loading state
  const { isRefreshing: isHistoryRefreshing, refresh: refreshCreditHistory } =
    useCreditHistoryContext()

  // Get wallets list, loading state, and refresh from context
  const {
    wallets,
    isLoading: walletsLoading,
    isRefreshing: isWalletsRefreshing,
    refresh: refreshWallets,
  } = useWalletListContext()

  // Combined refreshing state: either credit balance or wallet list is refreshing
  const isRefreshing = isCreditRefreshing || isWalletsRefreshing
  
  // Get currently selected scope/filter and setter from context
  const { scope, setScope, refresh: refreshActivity, isLoading: isActivityLoading } =
    useWalletActivityContext()

  // Handler for copying wallet address to clipboard
  // TODO: For React 19, consider using stable event handlers with useEffectEvent/useCallback as appropriate
  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      // Show toast notification for success, using translations
      toast({
        title: t('addressCopied'),
        description: t('addressCopiedDescription'),
      })
      // Reset copied state after 2 seconds for UX feedback pattern
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch {
      // Show destructive variant toast if copy fails
      toast({ title: t('copyFailed'), variant: 'destructive' })
    }
  }

  // Handler for refreshing all wallet data (balance, wallets, activity, credit history)
  const handleRefreshAll = async () => {
    await Promise.all([
      refetchBalance(),
      refreshWallets(),
      refreshActivity(),
      refreshCreditHistory(),
    ])
  }

  // Render loading spinner while balance is loading
  if (balanceLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--davinci-beam)]" />
      </div>
    )
  }

  // Render error state if balance fetch failed
  // Fatal only when bootstrap failed and we have no balance to show
  if (balanceError && !tokenBalance && !balanceLoading) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-xl font-semibold">{t('walletError')}</h2>
        <p className="mb-4 text-muted-foreground">{balanceError}</p>
        {/* Retry button triggers balance refetch */}
        <Button onClick={() => void refetchBalance()}>{t('tryAgain')}</Button>
      </div>
    )
  }

  // Render main wallet UI; WalletWrapper owns DavinciCenterPane
  return (
    <div className="space-y-6">
      <WalletBalanceHero
        locale={locale}
        creditAmount={tokenBalance?.amount ?? '0'}
        creditUsdEquivalent={tokenBalance?.main_currency_equivalent}
        wallets={wallets}
        walletsLoading={walletsLoading}
        selectedScope={scope}
        onSelectScope={setScope}
        copiedAddress={copiedAddress}
        onCopyAddress={(address) => void handleCopyAddress(address)}
        isRefreshing={isRefreshing || walletsLoading}
        onRefresh={() => void handleRefreshAll()}
      />

      <section className="space-y-3" aria-labelledby="wallet-transaction-history">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="wallet-transaction-history"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <TrendingUp className="h-4 w-4 text-[var(--davinci-beam)]" />
            {t('transactionHistory')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]"
            onClick={() => void handleRefreshAll()}
            disabled={isRefreshing || isHistoryRefreshing || isActivityLoading}
            aria-label={t('refresh')}
            title={t('autoRefreshEvery')}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 text-[var(--davinci-beam)]',
                (isRefreshing || isHistoryRefreshing || isActivityLoading) && 'animate-spin',
              )}
            />
          </Button>
        </div>
        <WalletTransactionFeed locale={locale} hideHeading historyTabs />
      </section>
    </div>
  )
}
