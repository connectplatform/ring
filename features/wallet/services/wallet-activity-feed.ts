import 'server-only' // This ensures the file runs only on the server (Next.js specific directive).

import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { getDefaultStoreCurrencySymbol } from '@/lib/ring-config-core'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { listWalletTransactionsByUser } from '@/lib/wallet/wallet-transaction-db'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'

// Defines the possible sources for wallet activity.
export type WalletActivitySource = 'credit' | 'chain'

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

/**
 * Determines direction ('in'/'out') for a credit transaction, based on its type.
 * Out if the type is one of CREDIT_DEBIT_TYPES, otherwise In.
 */
function creditDirection(tx: CreditTransaction): 'in' | 'out' {
  return CREDIT_DEBIT_TYPES.has(tx.type) ? 'out' : 'in'
}

/**
 * Determines the direction for chain transaction by kind.
 * Could be improved to cover more types explicitly.
 */
function chainDirection(kind: string): 'in' | 'out' {
  if (kind === 'native_token_send' || kind === 'desk_sell') return 'out'
  if (kind === 'desk_buy' || kind === 'native_token_receive') return 'in'
  return 'in' // Default to 'in' if unknown, but TODO: Consider explicit error/log for unknown kinds.
}

/**
 * Fetches and returns a unified wallet activity feed for a user, combining
 * both credit and/or chain activities, with efficient sorting and limiting.
 * 
 * @param userId - The user's ID to query history for
 * @param options - Filter, limit, and/or wallet address for narrowing results
 * @returns a promise of an array of normalized wallet activities (rows)
 */
export async function getWalletActivityFeed(
  userId: string,
  options?: {
    filter?: 'all' | 'credit' | 'chain'
    limit?: number
    walletAddress?: string
  },
): Promise<WalletActivityRow[]> {
  // Extract fetch options, providing sensible defaults
  const filter = options?.filter ?? 'all'
  const limit = options?.limit ?? 50

  // Get default fiat and native token symbols (could be improved/cached) 
  const fiatCurrency = getDefaultStoreCurrencySymbol()
  const tokenSymbol = getNativeTokenSymbol()

  // Result array to collect unified, normalized wallet activities
  const rows: WalletActivityRow[] = []

  // Handle credit transactions if needed
  if (filter === 'all' || filter === 'credit') {
    // Get the user's credit history with optional limiting
    const history = await creditBalanceService.getCreditHistory(userId, { limit })
    // Map each credit transaction to a standardized WalletActivityRow
    for (const tx of history.transactions) {
      rows.push({
        id: `credit:${tx.id}`,
        source: 'credit',
        kind: tx.type,
        amount: tx.amount,
        currency: fiatCurrency,
        direction: creditDirection(tx),
        createdAt: new Date(tx.timestamp).toISOString(),
        description: tx.description,
        metadata: tx.metadata,
      })
    }
    // TODO: Use Promise.all if additional asynchronous enrichment is added per transaction.
  }

  // Handle chain transactions if needed
  if (filter === 'all' || filter === 'chain') {
    // Fetch all relevant chain transactions for the user
    let chainTxs = await listWalletTransactionsByUser(userId, { limit })
    // Optional: Filter by specific wallet address if present
    if (options?.walletAddress) {
      const addr = options.walletAddress.toLowerCase()
      chainTxs = chainTxs.filter(
        (tx) =>
          tx.fromAddress?.toLowerCase() === addr || tx.toAddress?.toLowerCase() === addr,
      )
    }
    // Map each chain transaction to the unified WalletActivityRow
    for (const tx of chainTxs) {
      rows.push({
        // Each id is namespaced with `chain:` for deduplication and clarity
        // If both tx.id and tx.txHash are missing, fall back to a random UUID (shouldn't happen in production)
        id: `chain:${tx.id ?? tx.txHash ?? crypto.randomUUID()}`, // TODO: Validate uniqueness/consistency of IDs
        source: 'chain',
        kind: tx.kind,
        amount: tx.amount ?? '0', // Default zero if not present
        currency: tx.tokenSymbol ?? tokenSymbol, // Default to main chain token symbol if missing
        direction: chainDirection(tx.kind), // Compute the direction (in/out)
        createdAt: tx.createdAt ?? new Date().toISOString(), // Set as now if missing, but consider better fallback
        description: tx.notes ?? undefined,
        txHash: tx.txHash,
        metadata: {
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          deskOrderId: tx.deskOrderId,
        },
      })
    }
  }

  // Sort all collected activities by creation date (most recent first)
  // TODO: Use Array.prototype.toSorted (ES2023, supported in Node18+/Next16+) for immutable sorting.
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  // Optionally, in Node18+/Next16+:
  // const sortedRows = rows.toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Return the most recent [limit] items
  return rows.slice(0, limit)
}
