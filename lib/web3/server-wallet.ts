import 'server-only'

import { createWalletClient, http, type WalletClient, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { polygon } from 'viem/chains'
import { REFERRAL_CHAIN_ID } from '@/features/refcodes/constants'

const CHAINS: Record<number, Chain> = {
  137: polygon,
}

export function getReferralChain(): Chain {
  return CHAINS[REFERRAL_CHAIN_ID] || polygon
}

export function getReferralRpcUrl(): string {
  return process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com'
}

export function getReferralMinterWalletClient(): WalletClient | null {
  const key = process.env.REFERRAL_MINTER_PRIVATE_KEY
  if (!key) return null

  const normalized = key.startsWith('0x') ? key : `0x${key}`
  const account = privateKeyToAccount(normalized as `0x${string}`)
  const chain = getReferralChain()

  return createWalletClient({
    account,
    chain,
    transport: http(getReferralRpcUrl()),
  })
}

export function isReferralMinterConfigured(): boolean {
  return Boolean(
    process.env.REFERRAL_MINTER_PRIVATE_KEY &&
      process.env.REFERRAL_REWARDS_ADDRESS &&
      process.env.REFERRAL_REWARD_TOKEN_ADDRESS
  )
}
