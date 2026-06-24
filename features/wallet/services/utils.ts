import type { Wallet } from '@/features/auth/types'

export type WalletChain = 'solana' | 'evm'

/**
 * Select the user's default wallet, optionally filtered by chain.
 * Rows missing `chain` are treated as evm.
 */
export function selectDefaultWallet(
  wallets: Wallet[] | undefined | null,
  chain?: WalletChain,
): Wallet | null {
  if (!wallets || wallets.length === 0) return null

  const pool = chain
    ? wallets.filter((w) => (w.chain ?? 'evm') === chain)
    : wallets

  if (pool.length === 0) return null
  return pool.find((w) => w.isDefault) || pool[0]
}

export function inferWalletChain(wallet: Wallet): WalletChain {
  return wallet.chain ?? 'evm'
}
