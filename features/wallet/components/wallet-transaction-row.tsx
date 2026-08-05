'use client'

import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'
import type { Locale } from '@/i18n/shared'
import ContactCard from '@/components/contacts/contact-card'
import RingOrderWidget from './ring-order-widget'
import WalletTransactionDetailsFsModal, {
  type WalletTransactionDetailSource,
} from './wallet-transaction-details-fs-modal'
import {
  formatCreditAmount,
  formatRelativeTime,
  isCreditDebit,
} from '../lib/format-transaction'
import {
  getClientCreditUnitLabel,
  getClientNativeTokenSymbol,
} from '@/lib/ring-config-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WalletTransactionRowProps {
  transaction: CreditTransaction
  locale: Locale
  compact?: boolean
}

const POISONED_SYMBOLS = new Set(['solana', 'evm', 'base', 'ethereum', 'polygon', 'pol'])

function sanitizeTokenSymbol(value?: string | null): string | null {
  if (!value) return null
  if (value.startsWith('Undefined')) return null
  if (POISONED_SYMBOLS.has(value.toLowerCase())) return null
  return value
}

function counterpartyFromMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return null
  const username =
    typeof metadata.counterparty_username === 'string'
      ? metadata.counterparty_username
      : typeof metadata.contactUsername === 'string'
        ? metadata.contactUsername
        : undefined
  const name =
    typeof metadata.counterparty_name === 'string'
      ? metadata.counterparty_name
      : typeof metadata.contactDisplayName === 'string'
        ? metadata.contactDisplayName
        : undefined
  const photoURL =
    typeof metadata.counterparty_photo_url === 'string'
      ? metadata.counterparty_photo_url
      : undefined
  const address =
    typeof metadata.toAddress === 'string' ? metadata.toAddress : undefined
  if (!username && !name && !address) return null
  return { username, name, photoURL, address }
}

function tokenFromMetadata(metadata?: Record<string, unknown>): string {
  return (
    sanitizeTokenSymbol(
      typeof metadata?.tokenSymbol === 'string' ? metadata.tokenSymbol : null,
    ) ||
    sanitizeTokenSymbol(typeof metadata?.currency === 'string' ? metadata.currency : null) ||
    getClientNativeTokenSymbol()
  )
}

function creditBalanceUnitFromMetadata(metadata?: Record<string, unknown>): string {
  if (typeof metadata?.creditBalanceUnit === 'string' && metadata.creditBalanceUnit) {
    return metadata.creditBalanceUnit
  }
  return getClientCreditUnitLabel()
}

function resolveDetailRef(transaction: CreditTransaction): {
  detailId: string
  detailSource: WalletTransactionDetailSource
} | null {
  const meta = transaction.metadata
  const fromMetaId = typeof meta?.detailId === 'string' ? meta.detailId : null
  const fromMetaSource =
    meta?.detailSource === 'chain' || meta?.detailSource === 'credit'
      ? meta.detailSource
      : null

  if (fromMetaId && fromMetaSource) {
    return { detailId: fromMetaId, detailSource: fromMetaSource }
  }

  // Activity ids: chain:<docId> | credit:<id>
  if (transaction.id.startsWith('chain:')) {
    return { detailId: transaction.id.slice('chain:'.length), detailSource: 'chain' }
  }
  if (transaction.id.startsWith('credit:')) {
    return { detailId: transaction.id.slice('credit:'.length), detailSource: 'credit' }
  }

  // Credit-history provider rows (bare credit tx ids)
  return { detailId: transaction.id, detailSource: 'credit' }
}

export default function WalletTransactionRow({
  transaction,
  locale,
  compact = false,
}: WalletTransactionRowProps) {
  const t = useTranslations('modules.wallet.transactionKinds')
  const tDetails = useTranslations('modules.wallet.transactionDetails')
  const debit = isCreditDebit(transaction)
  const counterparty = counterpartyFromMetadata(transaction.metadata)
  const token = tokenFromMetadata(transaction.metadata)
  const creditBalanceUnit = creditBalanceUnitFromMetadata(transaction.metadata)
  const source = transaction.metadata?.source
  const [detailsOpen, setDetailsOpen] = useState(false)

  const kindKey = String(transaction.type)
  const isNativeSend = kindKey === 'nativetoken_send' || kindKey === 'native_token_send'
  const isNativeReceive =
    kindKey === 'nativetoken_receive' || kindKey === 'native_token_receive'
  const isDeskBuy = kindKey === 'desk_buy'
  const isDeskSell = kindKey === 'desk_sell'
  const isDeskRefund = kindKey === 'desk_refund'
  const isTreasurySwapIn = kindKey === 'treasury_swap_in'

  let kindLabel: string
  if (isNativeSend) {
    kindLabel = t('nativetoken_send', { token })
  } else if (isTreasurySwapIn) {
    kindLabel = t('treasury_swap_in', { token })
  } else if (isNativeReceive || (isDeskBuy && source === 'chain')) {
    kindLabel = t('nativetoken_receive', { token })
  } else if (isDeskBuy) {
    kindLabel = t('desk_buy_spend_credit', { creditUnit: creditBalanceUnit })
  } else if (isDeskSell && source === 'chain') {
    kindLabel = t('desk_sell', { token })
  } else if (isDeskSell) {
    kindLabel = t('desk_sell_credit', { creditUnit: creditBalanceUnit })
  } else if (isDeskRefund) {
    kindLabel = t('desk_refund', { creditUnit: creditBalanceUnit })
  } else if (kindKey === 'payment_request_sent') {
    kindLabel = t('payment_request_sent', { token })
  } else if (kindKey === 'payment_request_received') {
    kindLabel = t('payment_request_received', { token })
  } else {
    const knownKinds = new Set([
      'payment',
      'purchase',
      'membership_fee',
      'top_up',
      'credit_topup',
      'bonus',
      'reward_credit_add',
      'reimbursement',
      'refund',
      'penalty',
    ])
    if (knownKinds.has(kindKey)) {
      kindLabel = t(kindKey as 'payment', {
        token,
        creditUnit: creditBalanceUnit,
      })
    } else {
      kindLabel = transaction.description?.trim() || transaction.type.replace(/_/g, ' ')
    }
  }

  const showContact =
    isNativeSend &&
    counterparty &&
    Boolean(counterparty.username || counterparty.name)

  const detailRef = resolveDetailRef(transaction)

  return (
    <>
      <div
        className={cn(
          'flex items-stretch justify-between gap-2 py-2',
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
            <p className="text-sm font-medium truncate">{kindLabel}</p>
            {showContact && (
              <ContactCard
                locale={locale}
                compact
                name={counterparty.name}
                username={counterparty.username}
                photoURL={counterparty.photoURL}
                address={!counterparty.username ? counterparty.address : undefined}
                linkToProfile={Boolean(counterparty.username)}
              />
            )}
            {transaction.order_id && (
              <RingOrderWidget orderId={transaction.order_id} locale={locale} />
            )}
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(transaction.timestamp, locale)}
            </p>
          </div>
        </div>

        {detailRef && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-auto self-stretch w-9 shrink-0 rounded-lg"
            aria-label={tDetails('open')}
            title={tDetails('open')}
            onClick={() => setDetailsOpen(true)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}

        <span
          className={cn(
            'text-sm font-medium shrink-0 tabular-nums self-center',
            debit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          )}
        >
          {formatCreditAmount(transaction)}
        </span>
      </div>

      {detailRef && (
        <WalletTransactionDetailsFsModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          detailId={detailRef.detailId}
          detailSource={detailRef.detailSource}
        />
      )}
    </>
  )
}
