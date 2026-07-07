/**
 * Wallet Transactions Service — high-level read API for wallet_transactions.
 *
 * SSOT: thin wrapper over `lib/wallet/wallet-transaction-db.ts` (raw DB CRUD)
 * exposing service-level helpers (filtering, aggregation, formatting) for
 * server actions and API routes to consume.
 *
 * Reuses:
 *   - listWalletTransactionsByUser from wallet-transaction-db.ts
 *   - createWalletTransaction from wallet-transaction-db.ts
 *   - WalletTransactionKind/RollType from lib/wallet (canonical types)
 */

import 'server-only'

import { DEFAULT_WALLET_CHAIN } from '@/features/wallet/types/wallet'

import {
  listWalletTransactionsByUser,
  createWalletTransaction,
  type WalletTransactionRow,
  type WalletTransactionKind,
} from '@/lib/wallet/wallet-transaction-db'

// ---------------------------------------------------------------------------
// Re-exports — convenient for server actions / API routes
// ---------------------------------------------------------------------------

export { createWalletTransaction }
export type { WalletTransactionRow, WalletTransactionKind }

// ---------------------------------------------------------------------------
// Service-level helpers
// ---------------------------------------------------------------------------

/**
 * Get all wallet transactions for a user, sorted newest-first.
 * SSOT: delegates to wallet-transaction-db.listWalletTransactionsByUser.
 */
export async function getWalletTransactions(
  userId: string,
  options?: {
    kinds?: WalletTransactionKind[]
    limit?: number
  },
): Promise<WalletTransactionRow[]> {
  return listWalletTransactionsByUser(userId, options)
}

/**
 * Get transactions by chain (e.g., only Solana or only EVM).
 * SSOT: filters from the full list.
 */
export async function getTransactionsByChain(
  userId: string,
  chain: 'solana' | 'evm' | 'base',
  limit = 50,
): Promise<WalletTransactionRow[]> {
  const all = await listWalletTransactionsByUser(userId, { limit: limit * 2 })
  return all.filter((tx) => (tx.chain ?? DEFAULT_WALLET_CHAIN) === chain).slice(0, limit)
}

/**
 * Get only desk trades (credit ↔ native-token conversion).
 * SSOT: filter by kind in {'desk_buy', 'desk_sell'}.
 */
export async function getDeskTransactions(
  userId: string,
  limit = 50,
): Promise<WalletTransactionRow[]> {
  return listWalletTransactionsByUser(userId, {
    kinds: ['desk_buy', 'desk_sell'],
    limit,
  })
}

/**
 * Get only ring-send (native-token transfer) transactions.
 * SSOT: filter by kind === 'nativetoken_send'.
 */
export async function getRingTransfers(
  userId: string,
  limit = 50,
): Promise<WalletTransactionRow[]> {
  return listWalletTransactionsByUser(userId, {
    kinds: ['nativetoken_send'],
    limit,
  })
}
