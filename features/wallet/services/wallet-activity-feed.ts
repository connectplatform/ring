import 'server-only' // This ensures the file runs only on the server (Next.js specific directive).

import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { getClientCreditUnitLabel } from '@/lib/ring-config-client'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { listWalletTransactionsByUser } from '@/lib/wallet/wallet-transaction-db'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'

// Defines the possible sources for wallet activity.
export type WalletActivitySource = 'credit' | 'chain'

export type WalletActivityFeedFilter =
  | 'all'
  | 'credit'
  | 'chain'
  | 'incoming'
  | 'outgoing'
  | 'requests'

// Strongly-typed rows for wallet activity feed; new activities (credit or chain) must fit this shape.
export type WalletActivityRow = {
  id: string
  source: WalletActivitySource
  kind: string
  amount: string
  currency: string
  direction: 'in' | 'out'
  createdAt: string
  description?: string
  txHash?: string
  metadata?: Record<string, unknown>
}

// Set of transaction types considered as debits (outflows) for credits
const CREDIT_DEBIT_TYPES = new Set([
  'payment',
  'purchase',
  'membership_fee',
  'penalty',
  'desk_buy',
])

/** Credit legs of token-desk that belong with a wallet-scoped chain settlement */
const DESK_CREDIT_KINDS = new Set(['desk_buy', 'desk_sell', 'desk_refund'])

const POISONED_TOKEN_SYMBOLS = new Set([
  'solana',
  'evm',
  'base',
  'ethereum',
  'polygon',
  'pol',
])

const PAYMENT_REQUEST_KINDS = new Set([
  'payment_request_sent',
  'payment_request_received',
])

/**
 * Determines direction ('in'/'out') for a credit transaction, based on its type.
 * Out if the type is one of CREDIT_DEBIT_TYPES, otherwise In.
 */
function creditDirection(tx: CreditTransaction): 'in' | 'out' {
  return CREDIT_DEBIT_TYPES.has(tx.type) ? 'out' : 'in'
}

/**
 * Determines the direction for chain transaction by kind.
 * Kind SSOT: wallet_transactions.kind uses `nativetoken_send` / `nativetoken_receive`
 * (also accept legacy snake forms for older rows).
 */
function chainDirection(kind: string): 'in' | 'out' {
  if (
    kind === 'nativetoken_send' ||
    kind === 'native_token_send' ||
    kind === 'desk_sell' ||
    kind === 'payment_request_sent'
  ) {
    return 'out'
  }
  if (
    kind === 'nativetoken_receive' ||
    kind === 'native_token_receive' ||
    kind === 'desk_buy' ||
    kind === 'treasury_swap_in' ||
    kind === 'payment_request_received'
  ) {
    return 'in'
  }
  return 'in'
}

/** Sanitize ledger tokenSymbol pollution (chain ids / placeholder strings). */
function resolveChainCurrency(stored: string | undefined | null, fallback: string): string {
  if (!stored) return fallback
  if (stored.startsWith('Undefined')) return fallback
  if (POISONED_TOKEN_SYMBOLS.has(stored.toLowerCase())) return fallback
  return stored
}

function deskOrderIdFromCredit(tx: CreditTransaction): string | null {
  const meta = tx.metadata
  if (!meta || typeof meta !== 'object') return null
  const id = (meta as Record<string, unknown>).desk_order_id
  return typeof id === 'string' && id ? id : null
}

function matchesFeedFilter(row: WalletActivityRow, filter: WalletActivityFeedFilter): boolean {
  if (filter === 'all' || filter === 'credit' || filter === 'chain') return true
  if (filter === 'incoming') return row.direction === 'in'
  if (filter === 'outgoing') return row.direction === 'out'
  if (filter === 'requests') return PAYMENT_REQUEST_KINDS.has(row.kind)
  return true
}

/**
 * Fetches and returns a unified wallet activity feed for a user, combining
 * both credit and/or chain activities, with efficient sorting and limiting.
 */
export async function getWalletActivityFeed(
  userId: string,
  options?: {
    filter?: WalletActivityFeedFilter
    limit?: number
    walletAddress?: string
  },
): Promise<WalletActivityRow[]> {
  const filter = options?.filter ?? 'all'
  const limit = options?.limit ?? 50
  const walletAddress = options?.walletAddress?.toLowerCase()

  const creditBalanceUnit = getClientCreditUnitLabel()
  const tokenSymbol = getNativeTokenSymbol()

  const rows: WalletActivityRow[] = []

  // Directional / requests filters still need both sources, then post-filter.
  const needsBoth =
    filter === 'all' ||
    filter === 'incoming' ||
    filter === 'outgoing' ||
    filter === 'requests' ||
    Boolean(walletAddress)

  // `requests` is already covered by needsBoth; do not re-check here (TS narrows filter).
  const includeCredit = needsBoth || filter === 'credit'
  const includeChain = needsBoth || filter === 'chain'

  let chainTxsForScope = includeChain
    ? await listWalletTransactionsByUser(userId, {
        limit: walletAddress || filter === 'requests' ? Math.max(limit * 3, 50) : limit,
      })
    : []

  if (walletAddress) {
    chainTxsForScope = chainTxsForScope.filter(
      (tx) =>
        tx.fromAddress?.toLowerCase() === walletAddress ||
        tx.toAddress?.toLowerCase() === walletAddress ||
        PAYMENT_REQUEST_KINDS.has(tx.kind),
    )
  }

  const deskOrderIdsForWallet = new Set(
    chainTxsForScope
      .map((tx) => tx.deskOrderId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  )

  if (includeCredit && filter !== 'requests') {
    const history = await creditBalanceService.getCreditHistory(userId, { limit })
    for (const tx of history.transactions) {
      if (walletAddress) {
        if (!DESK_CREDIT_KINDS.has(tx.type)) continue
        const orderId = deskOrderIdFromCredit(tx)
        if (!orderId || !deskOrderIdsForWallet.has(orderId)) continue
      }

      rows.push({
        id: `credit:${tx.id}`,
        source: 'credit',
        kind: tx.type,
        amount: tx.amount,
        currency: creditBalanceUnit,
        direction: creditDirection(tx),
        createdAt: new Date(tx.timestamp).getTime()
          ? new Date(tx.timestamp).toISOString()
          : new Date().toISOString(),
        description: tx.description,
        metadata: {
          ...tx.metadata,
          creditBalanceUnit,
          tokenSymbol,
          detailId: tx.id,
          detailSource: 'credit',
        },
      })
    }
  }

  if (includeChain) {
    for (const tx of chainTxsForScope) {
      if (filter === 'requests' && !PAYMENT_REQUEST_KINDS.has(tx.kind)) continue

      const currency = resolveChainCurrency(tx.tokenSymbol, tokenSymbol)
      const docId = tx.id || tx.txHash
      const requestStatus =
        typeof tx.status === 'string' &&
        (tx.status === 'pending' || tx.status === 'paid' || tx.status === 'cancelled')
          ? tx.status
          : undefined

      rows.push({
        id: `chain:${docId || crypto.randomUUID()}`,
        source: 'chain',
        kind: tx.kind,
        amount: tx.amount ?? '0',
        currency,
        direction: chainDirection(tx.kind),
        createdAt: tx.createdAt ?? new Date().toISOString(),
        description: tx.notes ?? undefined,
        txHash: tx.txHash,
        metadata: {
          ...(tx.metadata ?? {}),
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          deskOrderId: tx.deskOrderId,
          contactUserId: tx.contactUserId,
          contactDisplayName: tx.contactDisplayName,
          contactUsername: tx.contactUsername,
          counterparty_name: tx.contactDisplayName ?? undefined,
          counterparty_username: tx.contactUsername ?? undefined,
          tokenSymbol: currency,
          detailId: docId,
          detailSource: 'chain',
          explorerUrl: tx.explorerUrl,
          status: tx.status,
          requestStatus,
          slot: tx.slot,
          blockTime: tx.blockTime,
          feeLamports: tx.feeLamports,
          amountRaw: tx.amountRaw,
          chain: tx.chain,
        },
      })
    }
  }

  const filtered = rows.filter((row) => matchesFeedFilter(row, filter))
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return filtered.slice(0, limit)
}
