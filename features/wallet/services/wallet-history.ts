// 🚀 RING-NATIVE: DatabaseService + React 19 cache()
// Wallet history now handled by wagmi hooks in React components
// This service provides legacy database read access only

import { cache } from 'react';

// Wallet history service - now uses wagmi hooks in components
// Legacy ethers-based functionality removed

// Cache recent transaction history (last 1000 blocks)
const transactionCache = new Map<string, any[]>()

export interface TransactionFilter {
  startBlock?: number;
  endBlock?: number;
  type?: string;
  minAmount?: string;
  maxAmount?: string;
}

const MAX_BLOCKS_PER_QUERY = 1000
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Gets a user's wallet address from Firestore
 * 
 * @param userId - The user's ID
 * @returns The user's wallet address or null if not found
 */
/**
 * Gets a user's wallet address from database
 * READ operation - uses React 19 cache() for performance
 */
export const getUserWalletAddress = cache(async (userId: string): Promise<string | null> => {
  const { initializeDatabase, getDatabaseService } = await import('@/lib/database/DatabaseService')
  
  await initializeDatabase()
  const db = getDatabaseService()
  
  const result = await db.read('users', userId)
  if (!result.success || !result.data) {
    return null
  }
  
  const userData = result.data as any
  return userData?.walletAddress || null
})

// Legacy ethers-based transaction processing functions removed
// Transaction history now handled by wagmi hooks in React components
// Use wagmi's useBlock, useTransaction, and useTransactionReceipt hooks
// for real-time transaction monitoring and history

/**
 * Gets transaction history for a wallet address
 * 
 * @param walletAddress - The wallet address to get history for
 * @param filter - The filter criteria to apply
 * @returns A promise that resolves to an array of transactions
 */
export async function getWalletHistory(walletAddress: string, filter: TransactionFilter): Promise<any[]> {
  throw new Error('DEPRECATED: Transaction history now handled by wagmi hooks in React components. Use useBlock and useTransaction hooks for real-time transaction monitoring.')
}