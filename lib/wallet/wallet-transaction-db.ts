import 'server-only'

import { cache } from 'react'
import { db } from '@/lib/database'

export type WalletTransactionKind =
  | 'nativetoken_send'
  | 'nativetoken_receive'
  | 'desk_buy'
  | 'desk_sell'
  | 'airdrop_verify'
  | 'airdrop_username'
  | string

export type WalletTransactionRow = {
  id?: string
  kind: WalletTransactionKind
  userId: string
  txHash?: string
  fromAddress?: string
  toAddress?: string
  amount?: string
  tokenSymbol?: string
  chain?: string
  notes?: string | null
  contactUserId?: string | null
  deskOrderId?: string | null
  createdAt?: string
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
