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

interface WalletPageClientProps {
  locale: Locale
  searchParams: Record<string, string | string[] | undefined>
  embedded?: boolean
}

export default function WalletPageClient({
  locale,
  embedded = false,
}: WalletPageClientProps) {
  const t = useTranslations('modules.wallet')
  const router = useRouter()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const {
    balance: tokenBalance,
    isLoading: balanceLoading,
    isRefreshing,
    error: balanceError,
    refresh: refetchBalance,
  } = useCreditBalanceContext()
  const { isRefreshing: isHistoryRefreshing } = useCreditHistoryContext()
  const { wallets, isLoading: walletsLoading, refresh: refreshWallets } = useWalletListContext()
  const { scope, setScope } = useWalletActivityContext()

  const hasLowBalance = parseFloat(tokenBalance?.amount || '0') < 1

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(address)
      toast({
        title: t('addressCopied'),
        description: t('addressCopiedDescription'),
      })
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch {
      toast({ title: t('copyFailed'), variant: 'destructive' })
    }
  }

  const handleRefreshAll = async () => {
    await Promise.all([refetchBalance(), refreshWallets()])
  }

  if (balanceLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--davinci-beam)]" />
      </div>
    )
  }

  if (balanceError) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-xl font-semibold">{t('walletError')}</h2>
        <p className="mb-4 text-muted-foreground">{balanceError}</p>
        <Button onClick={() => void refetchBalance()}>{t('tryAgain')}</Button>
      </div>
    )
  }

  return (
    <div className={cn('relative space-y-6', embedded && 'p-0')}>
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

      <DeskWidget />

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
    </div>
  )
}

