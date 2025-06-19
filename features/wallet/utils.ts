import { ethers } from 'ethers'
import { getServerAuthSession } from '@/auth'
import { Wallet } from '@/features/auth/types'
import { ensureWallet } from '@/services/wallet/ensure-wallet'
import { getWalletBalance as getWalletBalanceService } from '@/services/wallet/get-wallet-balance'

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
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error('User not authenticated')
  }

  // Check if the user already has a wallet
  if (session.user.wallets && session.user.wallets.length > 0) {
    return session.user.wallets[0].address
  }

  // If no wallet exists, create a new one using the service directly
  const wallet = await ensureWallet()
  return wallet.address
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
  const session = await getServerAuthSession()
  if (!session || !session.user || !session.user.wallets || session.user.wallets.length === 0) {
    return '0'
  }

  // Use the service directly instead of making an API call
  return await getWalletBalanceService()
}

/**
 * Formats the wallet balance from wei to ether
 * 
 * @param {string} balance - The balance in wei
 * @returns {string} The formatted balance in ether
 */
export function formatBalance(balance: string): string {
  return ethers.formatEther(balance)
}

