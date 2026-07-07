/**
 * Wallet activity feed types — Centralized SSOT for activity-related interfaces.
 *
 * SSOT: wallet-activity-feed.ts defines the query logic; types are here.
 */

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
