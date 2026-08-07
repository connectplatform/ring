'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { Locale } from '@/i18n/shared'
import { useCreditHistoryContext } from '@/components/providers/credit-history-provider'
import { useWalletActivityContext } from '@/components/providers/wallet-activity-provider'
import WalletTransactionRow from './wallet-transaction-row'
import type { WalletActivityRow } from '@/features/wallet/services/wallet-activity-feed'
import { getClientMainCurrency } from '@/lib/ring-config-client'
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
  /** Wallet page: All | Incoming | Outgoing | Requests */
  historyTabs?: boolean
}

function activityToCreditRow(row: WalletActivityRow, userId = ''): CreditTransaction {
  const mainCurrency = getClientMainCurrency()
  const signedAmount =
    row.direction === 'out' && !row.amount.startsWith('-') ? `-${row.amount}` : row.amount
  return {
    id: row.id,
    user_id: userId,
    type: row.kind as CreditTransaction['type'],
    amount: signedAmount,
    main_currency_equivalent: row.source === 'credit' ? row.amount : row.amount,
    main_currency_rate: '1',
    balance_after: row.amount,
    description: row.description ?? row.kind,
    timestamp: new Date(row.createdAt).getTime(),
    metadata: {
      ...row.metadata,
      currency: row.currency,
      mainCurrency,
      creditBalanceUnit:
        typeof row.metadata?.creditBalanceUnit === 'string'
          ? row.metadata.creditBalanceUnit
          : row.source === 'credit'
            ? row.currency
            : undefined,
      direction: row.direction,
      source: row.source,
    },
  }
}

export default function WalletTransactionFeed({
  locale,
  compact = false,
  showLoadMore = true,
  id = 'wallet-transactions',
  hideHeading = false,
  hideFilterTabs = false,
  historyTabs = false,
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
      : activity.scope.type === 'incoming'
        ? t('activityIncoming')
      : activity.scope.type === 'outgoing'
        ? t('activityOutgoing')
      : activity.scope.type === 'requests'
        ? t('activityRequests')
      : activity.scope.type === 'wallet'
        ? `${activity.scope.address.slice(0, 8)}…`
        : t('activityAll')

  const historyTabKeys = ['all', 'incoming', 'outgoing', 'requests'] as const

  return (
    <div id={id} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideHeading && (
          <h2 className="text-lg font-semibold">{t('transactionHistory')}</h2>
        )}
        {historyTabs ? (
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 p-0.5">
            {historyTabKeys.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={
                  (key === 'all' && activity.scope.type === 'all') ||
                  activity.scope.type === key
                    ? 'default'
                    : 'ghost'
                }
                className="h-7 px-2 text-xs"
                onClick={() =>
                  activity.setScope(
                    key === 'all'
                      ? { type: 'all' }
                      : key === 'incoming'
                        ? { type: 'incoming' }
                        : key === 'outgoing'
                          ? { type: 'outgoing' }
                          : { type: 'requests' },
                  )
                }
              >
                {key === 'all'
                  ? t('activityAll')
                  : key === 'incoming'
                    ? t('activityIncoming')
                    : key === 'outgoing'
                      ? t('activityOutgoing')
                      : t('activityRequests')}
              </Button>
            ))}
          </div>
        ) : !hideFilterTabs ? (
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
        ) : (
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
