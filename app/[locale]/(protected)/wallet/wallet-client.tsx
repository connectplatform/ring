'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useCreditHistoryContext } from '@/components/providers/credit-history-provider'
import { useWalletListContext } from '@/components/providers/wallet-list-provider'
import { useWalletActivityContext } from '@/components/providers/wallet-activity-provider'
import { toast } from '@/hooks/use-toast'
import WalletTransactionFeed from '@/features/wallet/components/wallet-transaction-feed'
import { WalletBalanceHero } from '@/features/wallet/components/wallet-balance-hero'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import type { Locale } from '@/i18n/shared'

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
  const { scope, setScope, refresh: refreshActivity } = useWalletActivityContext()

  // Compute whether user has low balance (below 1)
  const hasLowBalance = parseFloat(tokenBalance?.amount || '0') < 1

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

  // Render main wallet UI inside DaVinci center pane (matches /opportunities layout)
  return (
    <DavinciCenterPane contentClassName="space-y-6">
      <WalletBalanceHero
        locale={locale}
        creditAmount={tokenBalance?.amount ?? '0'}
        creditUsdEquivalent={tokenBalance?.usd_equivalent}
        wallets={wallets}
        walletsLoading={walletsLoading}
        selectedScope={scope}
        onSelectScope={setScope}
        copiedAddress={copiedAddress}
        onCopyAddress={(address) => void handleCopyAddress(address)}
        hasLowBalance={hasLowBalance}
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
          {isHistoryRefreshing && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>
        <WalletTransactionFeed locale={locale} hideHeading hideFilterTabs />
      </section>
    </DavinciCenterPane>
  )
}
