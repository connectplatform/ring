import 'server-only'

import { userCreditService } from '@/features/wallet/services/user-credit-service'
import { getRingCreditFiatCurrency } from '@/lib/ring-config-chain'
import { getRingConfigSnapshot } from '@/lib/ring-config-core'
import { listWalletTransactionsByUser } from '@/lib/wallet/wallet-transaction-db'
import type { CreditTransaction } from '@/lib/zod/credit-schemas'

export type WalletActivitySource = 'credit' | 'chain'

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

const CREDIT_DEBIT_TYPES = new Set([
  'payment',
  'purchase',
  'membership_fee',
  'penalty',
  'desk_buy',
])

function creditDirection(tx: CreditTransaction): 'in' | 'out' {
  return CREDIT_DEBIT_TYPES.has(tx.type) ? 'out' : 'in'
}

function chainDirection(kind: string): 'in' | 'out' {
  if (kind === 'ring_send' || kind === 'desk_sell') return 'out'
  if (kind === 'desk_buy' || kind === 'airdrop_verify' || kind === 'airdrop_username') return 'in'
  return 'in'
}

export async function getWalletActivityFeed(
  userId: string,
  options?: {
    filter?: 'all' | 'credit' | 'chain'
    limit?: number
    walletAddress?: string
  },
): Promise<WalletActivityRow[]> {
  const filter = options?.filter ?? 'all'
  const limit = options?.limit ?? 50
  const fiatCurrency = getRingCreditFiatCurrency()
  const tokenSymbol = getRingConfigSnapshot().tokens?.ring?.symbol ?? 'RING'
  const rows: WalletActivityRow[] = []

  if (filter === 'all' || filter === 'credit') {
    const history = await userCreditService.getCreditHistory(userId, { limit })
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
  }

  if (filter === 'all' || filter === 'chain') {
    let chainTxs = await listWalletTransactionsByUser(userId, { limit })
    if (options?.walletAddress) {
      const addr = options.walletAddress.toLowerCase()
      chainTxs = chainTxs.filter(
        (tx) =>
          tx.fromAddress?.toLowerCase() === addr || tx.toAddress?.toLowerCase() === addr,
      )
    }
    for (const tx of chainTxs) {
      rows.push({
        id: `chain:${tx.id ?? tx.txHash ?? crypto.randomUUID()}`,
        source: 'chain',
        kind: tx.kind,
        amount: tx.amount ?? '0',
        currency: tx.tokenSymbol ?? tokenSymbol,
        direction: chainDirection(tx.kind),
        createdAt: tx.createdAt ?? new Date().toISOString(),
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

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return rows.slice(0, limit)
}
