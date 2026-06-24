'use client'

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'
import type { Locale } from '@/i18n/shared'
import WalletContactWidget from './wallet-contact-widget'
import RingOrderWidget from './ring-order-widget'
import {
  formatCreditAmount,
  formatRelativeTime,
  isCreditDebit,
} from '../lib/format-transaction'
import { cn } from '@/lib/utils'

interface WalletTransactionRowProps {
  transaction: CreditTransaction
  locale: Locale
  compact?: boolean
}

function counterpartyFromMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return null
  const username =
    typeof metadata.counterparty_username === 'string'
      ? metadata.counterparty_username
      : undefined
  const name =
    typeof metadata.counterparty_name === 'string' ? metadata.counterparty_name : undefined
  const photoURL =
    typeof metadata.counterparty_photo_url === 'string'
      ? metadata.counterparty_photo_url
      : undefined
  if (!username && !name) return null
  return { username, name, photoURL }
}

export default function WalletTransactionRow({
  transaction,
  locale,
  compact = false,
}: WalletTransactionRowProps) {
  const debit = isCreditDebit(transaction)
  const counterparty = counterpartyFromMetadata(transaction.metadata)

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 py-2',
        !compact && 'border-b border-border/60 last:border-0'
      )}
    >
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {debit ? (
          <ArrowUpRight className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <ArrowDownLeft className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 space-y-1">
          {counterparty ? (
            <WalletContactWidget locale={locale} compact {...counterparty} />
          ) : (
            <p className="text-sm font-medium truncate">{transaction.description}</p>
          )}
          {transaction.order_id && (
            <RingOrderWidget orderId={transaction.order_id} locale={locale} />
          )}
          <p className="text-xs text-muted-foreground capitalize">
            {transaction.type.replace(/_/g, ' ')}
            {' · '}
            {formatRelativeTime(transaction.timestamp, locale)}
          </p>
        </div>
      </div>
      <span
        className={cn(
          'text-sm font-medium shrink-0 tabular-nums',
          debit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        )}
      >
        {formatCreditAmount(transaction)}
      </span>
    </div>
  )
}
