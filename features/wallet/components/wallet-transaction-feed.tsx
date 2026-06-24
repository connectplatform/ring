'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import { useCreditHistoryContext } from '@/components/providers/credit-history-provider'
import { useWalletActivityContext } from '@/components/providers/wallet-activity-provider'
import WalletTransactionRow from './wallet-transaction-row'
import type { WalletActivityRow } from '@/features/wallet/services/wallet-activity-feed'
import { getClientCreditFiatCurrency } from '@/lib/ring-config-client'
import { cn } from '@/lib/utils'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'

interface WalletTransactionFeedProps {
  locale: Locale
  compact?: boolean
  showLoadMore?: boolean
  id?: string
  hideHeading?: boolean
  /** When true, filter tabs are hidden (scope driven by wallet hero rows). */
  hideFilterTabs?: boolean
}

function activityToCreditRow(row: WalletActivityRow, userId = ''): CreditTransaction {
  const fiatCurrency = getClientCreditFiatCurrency()
  return {
    id: row.id,
    user_id: userId,
    type: row.kind as CreditTransaction['type'],
    amount: row.amount,
    usd_equivalent: row.source === 'credit' ? row.amount : row.amount,
    usd_rate: '1',
    balance_after: row.amount,
    description: row.description ?? row.kind,
    timestamp: new Date(row.createdAt).getTime(),
    metadata: { ...row.metadata, currency: row.currency, fiatCurrency },
  }
}

export default function WalletTransactionFeed({
  locale,
  compact = false,
  showLoadMore = true,
  id = 'wallet-transactions',
  hideHeading = false,
  hideFilterTabs = false,
}: WalletTransactionFeedProps) {
  const t = useTranslations('modules.wallet')
  const credit = useCreditHistoryContext()
  const activity = useWalletActivityContext()

  const useCreditOnly = activity.scope.type === 'credit'
  const transactions = useCreditOnly
    ? credit.transactions
    : activity.activities.map((row) => activityToCreditRow(row))
  const isLoading = useCreditOnly ? credit.isLoading : activity.isLoading
  const isRefreshing = useCreditOnly ? credit.isRefreshing : activity.isLoading
  const error = useCreditOnly ? credit.error : activity.error
  const hasMore = useCreditOnly ? credit.hasMore : false
  const loadMore = credit.loadMore

  const scopeLabel =
    activity.scope.type === 'credit'
      ? t('activityCredit')
      : activity.scope.type === 'chain'
        ? t('activityChain')
      : activity.scope.type === 'wallet'
        ? `${activity.scope.address.slice(0, 8)}…`
        : t('activityAll')

  return (
    <div id={id} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideHeading && (
          <h2 className="text-lg font-semibold">{t('transactionHistory')}</h2>
        )}
        {!hideFilterTabs && (
          <div className="flex gap-1 rounded-lg border border-border/60 p-0.5">
            {(['all', 'credit', 'chain'] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={activity.filter === key ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() =>
                  activity.setScope(
                    key === 'credit'
                      ? { type: 'credit' }
                      : key === 'chain'
                        ? { type: 'chain' }
                        : { type: 'all' },
                  )
                }
              >
                {key === 'all'
                  ? t('activityAll')
                  : key === 'credit'
                    ? t('activityCredit')
                    : t('activityChain')}
              </Button>
            ))}
          </div>
        )}
        {hideFilterTabs && (
          <span className="text-xs text-muted-foreground">
            {t('showingFor', { wallet: scopeLabel })}
          </span>
        )}
        {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {isLoading && transactions.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('noTransactions')}</p>
      ) : (
        <div className={cn(compact ? 'space-y-1' : 'space-y-0')}>
          {transactions.map((tx) => (
            <WalletTransactionRow
              key={tx.id}
              transaction={tx}
              locale={locale}
              compact={compact}
            />
          ))}
        </div>
      )}

      {showLoadMore && hasMore && useCreditOnly && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => void loadMore()}>
          {t('loadMoreTransactions')}
        </Button>
      )}
    </div>
  )
}
