'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Wallet, AlertTriangle, Loader2, TrendingUp } from 'lucide-react'
import { useCreditBalanceContext } from '@/components/providers/credit-balance-provider'
import { useCreditHistoryContext } from '@/components/providers/credit-history-provider'
import { useWalletListContext } from '@/components/providers/wallet-list-provider'
import { useWalletActivityContext } from '@/components/providers/wallet-activity-provider'
import { getClientCreditFiatCurrency } from '@/lib/ring-config-client'
import { toast } from '@/hooks/use-toast'
import WalletTransactionFeed from '@/features/wallet/components/wallet-transaction-feed'
import DeskWidget from '@/features/wallet/components/desk-widget'
import { WalletBalanceHero } from '@/features/wallet/components/wallet-balance-hero'
import { cn } from '@/lib/utils'
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
  // Next.js router for navigation
  const router = useRouter()
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
  const { isRefreshing: isHistoryRefreshing } = useCreditHistoryContext()

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
  const { scope, setScope } = useWalletActivityContext()

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

  // Handler for refreshing all wallet data (balance & wallets list) in parallel
  const handleRefreshAll = async () => {
    await Promise.all([refetchBalance(), refreshWallets()])
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
  if (balanceError) {
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

  // Render main wallet UI
  return (
    <div className={cn('relative space-y-6', embedded && 'p-0')}>
      {/* If not embedded, show wallet header and description */}
      {!embedded && (
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
              )}
            >
              <Wallet className="h-5 w-5 text-[var(--davinci-beam)]" />
            </span>
            {t('title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>
      )}

      {/* Show balance hero, passing through data and handlers */}
      <WalletBalanceHero
        creditAmount={tokenBalance?.amount ?? '0'}
        creditCurrency={getClientCreditFiatCurrency()}
        wallets={wallets}
        walletsLoading={walletsLoading}
        selectedScope={scope}
        onSelectScope={setScope}
        copiedAddress={copiedAddress}
        onCopyAddress={(address) => void handleCopyAddress(address)}
        hasLowBalance={hasLowBalance}
        isRefreshing={isRefreshing || walletsLoading}
        onRefresh={() => void handleRefreshAll()}
        onTopUp={() => router.push('/wallet/topup')}
      />

      {/* STUB: Integrate DeskWidget with personalized content for user's context
          // TODO: Fetch any required data for DeskWidget if needed - move logic to component/provider if needed */}
      <DeskWidget />

      {/* Transaction history section, with refresh indication and feed */}
      <section className="space-y-3" aria-labelledby="wallet-transaction-history">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="wallet-transaction-history"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <TrendingUp className="h-4 w-4 text-[var(--davinci-beam)]" />
            {t('transactionHistory')}
          </h2>
          {/* Show spinner while transaction history is refreshing */}
          {isHistoryRefreshing && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>
        {/* TODO: Convert WalletTransactionFeed to server component if possible for SSR perf
            // Otherwise, memoize expensive subcomponents */}
        <WalletTransactionFeed locale={locale} hideHeading hideFilterTabs />
      </section>
    </div>
  )
}
