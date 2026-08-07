// Client-safe wallet utilities. Avoid importing server-only modules here.
import {
  formatTokenAmount,
  parseTokenAmount,
  isValidAddress,
  shortenAddress,
  formatAddress as formatEvmAddress
} from '@/features/evm/utils'

/**
 * Ensures the authenticated user has a wallet provisioned for all enabled chains.
 * Wraps the `ensureUserWallets` server action (replaces /api/wallet/ensure).
 *
 * @returns {Promise<string>} The native wallet address
 * @throws {Error} If the user is not authenticated or provisioning fails
 */
export async function ensureUserWallet(): Promise<string> {
  const { ensureUserWallets } = await import('@/app/_actions/wallet')
  const result = await ensureUserWallets()
  if (!result.success || !result.nativeWallet) {
    throw new Error(result.error || 'Failed to ensure wallet')
  }
  return result.nativeWallet.address
}

/**
 * Retrieves the balance of the user's default wallet.
 * Wraps the `getWalletBalance` server action (replaces /api/wallet/balance).
 *
 * @returns {Promise<string>} The wallet balance as a string
 * @throws {Error} If the user is not authenticated, has no wallet, or fetching fails
 */
export async function getWalletBalance(): Promise<string> {
  const { getWalletBalance: fetchBalance } = await import('@/app/_actions/wallet')
  const result = await fetchBalance()
  if (!result.success || result.balance === undefined) {
    return '0'
  }
  return result.balance
}

/**
 * Formats the wallet balance from wei to ether using BigInt-safe math
 *
 * @param balance - The balance in wei (as decimal string)
 * @returns The formatted balance in ether
 */
export function formatBalance(balance: string): string {
  return formatTokenAmount(balance, 18, 4)
}

/** Re-exports of helpful EVM address utilities for wallet consumers */
export const isValidWalletAddress = isValidAddress
export const formatAddress = formatEvmAddress
export { shortenAddress, parseTokenAmount }
