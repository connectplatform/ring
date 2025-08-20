// Client-safe wallet utilities. Avoid importing server-only modules here.
import { Wallet } from '@/features/auth/types'
import { 
  formatTokenAmount,
  parseTokenAmount,
  isValidAddress,
  shortenAddress,
  formatAddress as formatEvmAddress
} from '@/features/evm/utils'

/**
 * Ensures that the authenticated user has a wallet
 * 
 * User steps:
 * 1. User attempts to access a feature requiring a wallet
 * 2. This function is called to check if the user has a wallet
 * 3. If no wallet exists, a new one is created
 * 4. The wallet address is returned
 * 
 * @returns {Promise<string>} The wallet address
 * @throws {Error} If the user is not authenticated or if wallet creation fails
 */
export async function ensureUserWallet(): Promise<string> {
  const response = await fetch('/api/wallet/ensure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    const data = await safeJson(response)
    throw new Error(data?.error || 'Failed to ensure wallet')
  }
  const data = await response.json()
  return data.address as string
}

/**
 * Creates a new wallet for the authenticated user
 * 
 * User steps:
 * 1. User requests to create a new wallet
 * 2. This function is called to create the wallet
 * 3. The new wallet address is returned
 * 
 * @returns {Promise<{ address: string }>} An object containing the new wallet address
 * @throws {Error} If the user is not authenticated, already has a wallet, or if wallet creation fails
 */
export async function createWallet(): Promise<{ address: string }> {
  const response = await fetch('/api/wallet/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json()
    if (response.status === 401) {
      throw new Error('Unauthorized: Please log in to create a wallet')
    } else if (response.status === 409) {
      throw new Error('Wallet already exists for this user')
    } else {
      throw new Error(`Failed to create wallet: ${errorData.error}`)
    }
  }

  const data = await response.json()
  return { address: data.address }
}

/**
 * Retrieves the balance of the user's default wallet
 * 
 * User steps:
 * 1. User requests to view their wallet balance
 * 2. This function is called to fetch the balance
 * 3. The balance is returned as a string
 * 
 * @returns {Promise<string>} The wallet balance as a string
 * @throws {Error} If the user is not authenticated, has no wallet, or if balance fetching fails
 */
export async function getWalletBalance(): Promise<string> {
  const response = await fetch('/api/wallet/balance', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    return '0'
  }
  const data = await response.json()
  return String(data.balance ?? '0')
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

async function safeJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

