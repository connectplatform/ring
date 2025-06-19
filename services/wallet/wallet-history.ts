import { ethers } from 'ethers'
import { cache } from 'react'
import { getAdminDb } from '@/lib/firebase-admin.server'

// Cache the provider to avoid creating a new instance on every request
export const getProvider = cache(() => new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL))

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
export async function getUserWalletAddress(userId: string): Promise<string | null> {
  const adminDb = await getAdminDb()
  const userDoc = await adminDb.collection('users').doc(userId).get()
  const userData = userDoc.data()
  
  return userData?.walletAddress || null
}

/**
 * Fetches transaction logs from the blockchain
 * 
 * @param provider - The ethers.js provider instance
 * @param address - The wallet address to fetch logs for
 * @param startBlock - The starting block number
 * @param endBlock - The ending block number
 * @returns A promise that resolves to an array of transaction logs
 */
export async function fetchLogs(provider: ethers.JsonRpcProvider, address: string, startBlock: number, endBlock: number): Promise<ethers.Log[]> {
  const filter = {
    address: address,
    fromBlock: startBlock,
    toBlock: endBlock
  }

  let retries = 3
  while (retries > 0) {
    try {
      return await provider.getLogs(filter)
    } catch (error) {
      console.error(`Error fetching logs (retries left: ${retries}):`, error)
      retries--
      if (retries === 0) throw error
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retrying
    }
  }
  throw new Error('Failed to fetch logs after multiple attempts')
}

/**
 * Processes and filters transaction logs
 * 
 * @param provider - The ethers.js provider instance
 * @param logs - The array of transaction logs to process
 * @param filter - The filter criteria to apply
 * @returns A promise that resolves to an array of processed transactions
 */
export async function processLogs(provider: ethers.JsonRpcProvider, logs: ethers.Log[], filter: TransactionFilter): Promise<any[]> {
  const transactions = await Promise.all(logs.map(async (log) => {
    try {
      const tx = await provider.getTransaction(log.transactionHash)
      const receipt = await provider.getTransactionReceipt(log.transactionHash)
      
      if (!tx || !receipt) return null

      const block = await provider.getBlock(log.blockNumber)
      if (!block) return null

      const value = ethers.formatEther(tx.value || '0')
      
      // Apply filters
      if (
        (filter.type && tx.type !== parseInt(filter.type)) ||
        (filter.minAmount && parseFloat(value) < parseFloat(filter.minAmount)) ||
        (filter.maxAmount && parseFloat(value) > parseFloat(filter.maxAmount))
      ) {
        return null
      }

      return {
        hash: log.transactionHash,
        from: tx.from,
        to: tx.to,
        value: value,
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : null,
        gasLimit: tx.gasLimit?.toString(),
        gasUsed: receipt.gasUsed?.toString(),
        timestamp: block.timestamp,
        status: receipt.status === 1 ? 'Success' : 'Failed',
        type: tx.type,
        contractInteraction: tx.to !== null && tx.data !== '0x'
      }
    } catch (error) {
      console.error('Error processing transaction:', error)
      return null
    }
  }))

  return transactions.filter(tx => tx !== null)
}

/**
 * Gets transaction history for a wallet address
 * 
 * @param walletAddress - The wallet address to get history for
 * @param filter - The filter criteria to apply
 * @returns A promise that resolves to an array of transactions
 */
export async function getWalletHistory(walletAddress: string, filter: TransactionFilter): Promise<any[]> {
  const provider = getProvider()
  
  // Fetch the latest block number and determine block range
  const latestBlock = await provider.getBlockNumber()
  const endBlock = filter.endBlock || latestBlock
  const startBlock = filter.startBlock || Math.max(0, endBlock - MAX_BLOCKS_PER_QUERY + 1)

  console.log('Services: getWalletHistory - Block range:', { startBlock, endBlock });

  // Check if we have cached data
  const cacheKey = `${walletAddress}-${startBlock}-${endBlock}`
  let transactions = transactionCache.get(cacheKey)

  if (!transactions) {
    console.log('Services: getWalletHistory - Cache miss, fetching logs');
    // Fetch logs if not in cache
    const logs = await fetchLogs(provider, walletAddress, startBlock, endBlock)
    transactions = await processLogs(provider, logs, filter)

    // Cache the results
    transactionCache.set(cacheKey, transactions)
    setTimeout(() => transactionCache.delete(cacheKey), CACHE_DURATION)
  } else {
    console.log('Services: getWalletHistory - Cache hit');
  }

  return transactions
}