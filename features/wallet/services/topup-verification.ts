import 'server-only'

import { createPublicClient, http, parseAbiItem, parseUnits, type Address } from 'viem'
import { polygon } from 'viem/chains'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

export interface TopUpVerificationResult {
  verified: boolean
  reason?: string
  fromAddress?: string
}

function getRpcUrl(): string {
  return process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com'
}

function getTokenAddress(): Address | null {
  const addr = process.env.REFERRAL_REWARD_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RING_TOKEN_ADDRESS
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return null
  return addr as Address
}

function getTreasuryAddress(): Address | null {
  const addr = process.env.CREDIT_TREASURY_ADDRESS
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return null
  return addr as Address
}

/** Chain proof is required by default in production; opt out only explicitly. */
export function isChainProofRequired(): boolean {
  const flag = process.env.CREDIT_TOPUP_REQUIRE_CHAIN_PROOF
  if (flag === 'false') return false
  if (flag === 'true') return true
  return process.env.NODE_ENV === 'production'
}

/**
 * Reserve a tx hash for crediting — globally unique row in wallet_transactions.
 * Returns false when the hash was already used (replay attempt).
 */
export async function reserveTopUpTxHash(txHash: string, userId: string, amount: string): Promise<boolean> {
  const id = `topup_${txHash.toLowerCase()}`

  const existing = await db().findDocById('wallet_transactions', id)
  if (existing.success && existing.data) return false

  const created = await db().createDoc(
    'wallet_transactions',
    {
      kind: 'credit_topup',
      txHash: txHash.toLowerCase(),
      userId,
      amount,
      createdAt: new Date().toISOString(),
    },
    { id }
  )
  return created.success
}

/**
 * Verify an on-chain ERC20 transfer backing a credit top-up:
 * receipt success + token Transfer to treasury, from one of the user's wallets,
 * value >= requested amount.
 */
export async function verifyTopUpTransaction(params: {
  txHash: string
  amount: string
  userWallets: string[]
}): Promise<TopUpVerificationResult> {
  const token = getTokenAddress()
  const treasury = getTreasuryAddress()

  if (!token) return { verified: false, reason: 'Reward token address not configured' }
  if (!treasury) return { verified: false, reason: 'CREDIT_TREASURY_ADDRESS not configured' }

  try {
    const client = createPublicClient({ chain: polygon, transport: http(getRpcUrl()) })
    const receipt = await client.getTransactionReceipt({ hash: params.txHash as `0x${string}` })

    if (receipt.status !== 'success') {
      return { verified: false, reason: 'Transaction reverted' }
    }

    const wallets = new Set(params.userWallets.filter(Boolean).map((w) => w.toLowerCase()))
    const required = parseUnits(params.amount, 18)

    const { parseEventLogs } = await import('viem')
    const transfers = parseEventLogs({ abi: [TRANSFER_EVENT], logs: receipt.logs })
    for (const decoded of transfers) {
      if (decoded.address.toLowerCase() !== token.toLowerCase()) continue
      try {
        const { from, to, value } = decoded.args as { from: Address; to: Address; value: bigint }

        if (
          to.toLowerCase() === treasury.toLowerCase() &&
          wallets.has(from.toLowerCase()) &&
          value >= required
        ) {
          return { verified: true, fromAddress: from }
        }
      } catch {
        /* non-Transfer log */
      }
    }

    return { verified: false, reason: 'No matching token transfer to treasury found in transaction' }
  } catch (error) {
    logger.error('topup-verification: receipt check failed', { txHash: params.txHash, error })
    return { verified: false, reason: 'Failed to fetch transaction receipt' }
  }
}
