import 'server-only'

import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type Chain,
} from 'viem'
import { polygon } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import type { Wallet } from '@/features/auth/types'
import { getNativeChainConfig, getNativeTokenDecimals } from '@/lib/ring-config-chain'
import { decryptUserWalletPrivateKey } from '@/lib/wallet/decrypt-user-wallet'
import { logger } from '@/lib/logger'
import { cache } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// EVM chain config resolution (SSOT: ring-config.json → chains.evm)
// ─────────────────────────────────────────────────────────────────────────────

/** Map a numeric chainId to the corresponding viem Chain object (well-known EVM IDs only). */
function viemChainById(chainId: number): Chain {
  // For now, the ring-platform.org EVM chain is Polygon (id 137). Generic maps
  // can be added when Base L2 or other EVM chains go live.
  if (chainId === 137) return polygon
  // Fallback: construct a lightweight chain shape for any EVM-compatible ID
  return { id: chainId, name: `EVM-${chainId}`, nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [] } } } as unknown as Chain
}

function getEvmChainTokenAddress(): Address | null {
  const addr = getNativeChainConfig().evm?.tokenAddress
  if (!addr || addr === '0x0000000000000000000000000000000000000000' || addr.trim() === '') {
    return null
  }
  return addr as Address
}

function getEvmChainId(): number {
  return getNativeChainConfig().evm?.chainId ?? 137
}

function getEvmRpcUrl(): string {
  const rpcUrlEnv = getNativeChainConfig().evm?.rpcUrlEnv
  if (rpcUrlEnv && process.env[rpcUrlEnv]) {
    return process.env[rpcUrlEnv]!
  }
  // Legacy fallback: the well-known Polygon RPC env var
  return process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon'
}

function getEvmTokenDecimals(): number {
  return getNativeTokenDecimals('evm') ?? 18
}

// ─────────────────────────────────────────────────────────────────────────────
// Public client factory (SSOT-driven — no hardcoded chain)
// ─────────────────────────────────────────────────────────────────────────────

function getPublicClient() {
  const chainId = getEvmChainId()
  return createPublicClient({
    chain: viemChainById(chainId),
    transport: http(getEvmRpcUrl()),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance read (SSOT-driven)
// ─────────────────────────────────────────────────────────────────────────────

/** React 19 server-side memoised wrapper — deduplicates in-flight requests per render. */
export const getEvmTokenBalanceCached = cache(async (walletAddress: string): Promise<string> => {
  return getEvmTokenBalance(walletAddress)
})

/**
 * Fetch the native token balance (ERC20) for an EVM wallet address.
 * Resolves token address, decimals, chain, and RPC from ring-config SSOT.
 */
export async function getEvmTokenBalance(walletAddress: string): Promise<string> {
  const token = getEvmChainTokenAddress()
  if (!token) {
    // Token not deployed/configured — return 0 rather than throw
    return '0'
  }

  const client = getPublicClient()
  const decimals = getEvmTokenDecimals()

  const callData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddress as Address],
  })

  let result
  try {
    result = await client.call({ to: token, data: callData })
  } catch (error) {
    throw new Error(`Failed to call balanceOf on EVM chain ${getEvmChainId()}: ${(error as Error).message}`)
  }

  const balance = decodeFunctionResult({
    abi: erc20Abi,
    functionName: 'balanceOf',
    data: result.data ?? '0x0',
  }) as bigint

  return formatUnits(balance, decimals)
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer (unchanged below — uses private key, still Polygon-specific for the
// custodial send path; chain-configurable abstraction is TODO.)
// ─────────────────────────────────────────────────────────────────────────────

/** Placeholder: get the Polygon token address for the transfer path. */
function getTransferTokenAddress(): Address {
  const addr = getEvmChainTokenAddress()
  if (!addr) throw new Error('EVM token address not configured for transfers')
  return addr
}

// Memoized version of getEvmTokenBalance for optimal revalidation (React 19 cache)
// (moved up to line 77)

/**
 * Transfers native EVM tokens from the user's wallet to a destination address.
 * Uses the decrypted private key to sign the transaction.
 */
export async function transferEvmTokens(params: {
  senderWallet: Wallet
  toAddress: string
  amount: string
  encryptionKey?: string
}): Promise<{ txHash: string }> {
  const encryptionKey = params.encryptionKey ?? process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  const token = getTransferTokenAddress()
  const decimals = getEvmTokenDecimals()
  const value = parseUnits(params.amount, decimals)

  const privateKey = decryptUserWalletPrivateKey(
    params.senderWallet.encryptedPrivateKey,
    encryptionKey,
  )

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const chainId = getEvmChainId()

  const walletClient = createWalletClient({
    account,
    chain: viemChainById(chainId),
    transport: http(getEvmRpcUrl()),
  })

  const { request: approvalRequest } = await getPublicClient().simulateContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [params.toAddress as Address, value],
  })

  const txHash = await walletClient.writeContract(approvalRequest)
  return { txHash }
}

// -------------------------------------------------------------------------
// Legacy helpers — kept for back-compat until consumers migrate to SSOT
// -------------------------------------------------------------------------

/**
 * @deprecated Use getEvmChainTokenAddress() — chain-aware via SSOT.
 */
function getTokenAddress(): Address {
  return getTransferTokenAddress()
}

/** @deprecated Use getEvmChainId() — chain-aware via SSOT. */
export const EVM_CHAIN_ID: number = getEvmChainId()
