import type { Wallet } from '@/features/auth/types'

/**
 * Select the user's default wallet, falling back to the first wallet.
 */
export function selectDefaultWallet(wallets: Wallet[] | undefined | null): Wallet | null {
  if (!wallets || wallets.length === 0) return null
  return wallets.find(w => w.isDefault) || wallets[0]
}


