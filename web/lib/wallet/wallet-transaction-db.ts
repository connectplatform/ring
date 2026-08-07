import 'server-only'

import { cache } from 'react'
import { db } from '@/lib/database'

export type WalletTransactionKind =
  | 'nativetoken_send'
  | 'nativetoken_receive'
  | 'desk_buy'
  | 'desk_sell'
  | 'treasury_swap_in'
  | 'airdrop_verify'
  | 'airdrop_username'
  | 'payment_request_sent'
  | 'payment_request_received'
  | string

export type WalletTransactionRow = {
  id?: string
  kind: WalletTransactionKind
  userId: string
  txHash?: string
  /** Raw integer amount in token smallest units (on-chain) */
  amountRaw?: string | null
  amount?: string
  tokenSymbol?: string
  chain?: string
  mint?: string | null
  notes?: string | null
  contactUserId?: string | null
  /** Human label for recipient (saved at send time for history i18n) */
  contactDisplayName?: string | null
  /** Username for public profile link */
  contactUsername?: string | null
  deskOrderId?: string | null
  createdAt?: string
  /** On-chain confirmation status — also used for payment_request_* lifecycle */
  status?: 'confirmed' | 'finalized' | 'failed' | 'unknown' | 'pending' | 'paid' | 'cancelled' | string | null
  slot?: number | null
  blockTime?: number | null
  feeLamports?: number | null
  explorerUrl?: string | null
  err?: string | null
  /** JSON-safe RPC snapshot for detail modal */
  onChainSnapshot?: Record<string, unknown> | null
  fromAddress?: string
  toAddress?: string
  /** Extensible payload (payment request linkage, etc.) */
  metadata?: Record<string, unknown> | null
}

type DocRow = WalletTransactionRow & Record<string, unknown> & { id: string }

/**
 * Fetches wallet transactions for a particular user, with support for filtering by transaction kind and limiting count.
 * Now wrapped with React's cache() to improve deduplication and avoid redundant fetches in concurrent server environments.
 * @param userId The unique identifier of the user.
 * @param options Optional object containing filter kinds and a result limit.
 * @returns Promise of matching WalletTransactionRow array, defaults to empty array if none found or error.
 */
export const listWalletTransactionsByUser = cache(
  async (
    userId: string,
    options?: { kinds?: WalletTransactionKind[]; limit?: number },
  ): Promise<WalletTransactionRow[]> => {
    const filters: Array<{ field: string; operator: '=='; value: string }> = [
      { field: 'userId', operator: '==', value: userId },
    ]

    const result = await db().queryDocs<DocRow>({
      collection: 'wallet_transactions',
      filters,
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: options?.limit ?? 50 },
    })

    if (!result.success || !result.data) {
      return []
    }

    let rows = result.data

    if (options?.kinds?.length) {
      const kinds = new Set(options.kinds)
      rows = rows.filter((r) => kinds.has(r.kind as WalletTransactionKind))
    }

    return rows
  }
)

export async function createWalletTransaction(
  row: WalletTransactionRow,
  id?: string,
): Promise<string> {
  const docId = id ?? row.id ?? `wtx_${typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`
  const payload = {
    ...row,
    createdAt: row.createdAt ?? new Date().toISOString(),
  }

  const result = await db().createDoc('wallet_transactions', payload, { id: docId })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to create wallet transaction')
  }

  return docId
}

/**
 * Patch an existing wallet_transactions doc by id (no ownership check — caller must authorize).
 */
export async function updateWalletTransaction(
  transactionId: string,
  patch: Partial<WalletTransactionRow>,
): Promise<void> {
  const result = await db().updateDoc('wallet_transactions', transactionId, patch)
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to update wallet transaction')
  }
}

/**
 * Fetch a single wallet_transactions doc by id (owner-scoped).
 */
export async function getWalletTransactionById(
  userId: string,
  transactionId: string,
): Promise<(WalletTransactionRow & { id: string }) | null> {
  const result = await db().findDocById<DocRow>('wallet_transactions', transactionId)
  if (!result.success || !result.data) return null
  if (result.data.userId !== userId) return null
  return result.data
}

/** Deterministic ledger ids for a payment-request message. */
export function paymentRequestLedgerIds(messageId: string) {
  return {
    sentId: `payment_request_sent_${messageId}`,
    receivedId: `payment_request_received_${messageId}`,
  }
}
