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
import { getNativeTokenDecimals, getEvmRpcUrl, getEvmChainId, getEvmTokenAddress } from '@/lib/ring-config-chain'
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
  const addr = getEvmTokenAddress()
  return addr ? (addr as Address) : null
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
 * Fetch the configured EVM RING ERC-20 balance for a wallet address.
 *
 * This is NOT the platform-native balance when `chains.native === 'solana'`.
 * Platform-native SSOT is `getNativeTokenBalanceForUser()` → solana SPL or EVM
 * based on `getNativeChain()`. Use this helper only for:
 *   - custodial EVM/Base wallets (wallet.chain === 'evm'|'base')
 *   - EVM RING token when `chains.evm.tokenAddress` is set
 *
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

/**
 * ERC-20 balanceOf for an arbitrary allowlisted token (treasury swap, diversify).
 * For the configured RING ERC-20 on this EVM chain, prefer getEvmTokenBalance().
 * For platform-native RING (Solana or EVM per chains.native), use
 * getNativeTokenBalanceForUser() in native-token-transfer-service.
 */
export async function getEvmErc20Balance(
  tokenAddress: string,
  walletAddress: string,
  decimals = 18,
): Promise<string> {
  if (!tokenAddress || !walletAddress) return '0'
  const raw = await getEvmErc20BalanceRaw(tokenAddress, walletAddress)
  return formatUnits(raw, decimals)
}

export async function getEvmErc20BalanceRaw(
  tokenAddress: string,
  walletAddress: string,
): Promise<bigint> {
  if (!tokenAddress || !walletAddress) return 0n
  const client = getPublicClient()
  const callData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddress as Address],
  })
  const result = await client.call({ to: tokenAddress as Address, data: callData })
  return decodeFunctionResult({
    abi: erc20Abi,
    functionName: 'balanceOf',
    data: result.data ?? '0x0',
  }) as bigint
}

/**
 * Verify an ERC-20 Transfer in a mined tx: from → to, matching token + min amount.
 */
export async function verifyErc20TransferInTx(params: {
  txHash: `0x${string}`
  tokenAddress: Address
  fromAddress: Address
  toAddress: Address
  minAmountRaw: bigint
}): Promise<{ ok: true; amountRaw: bigint; blockNumber: bigint } | { ok: false; error: string }> {
  const client = getPublicClient()
  const receipt = await client.getTransactionReceipt({ hash: params.txHash })
  if (!receipt || receipt.status !== 'success') {
    return { ok: false, error: 'transaction_not_successful' }
  }

  const { parseEventLogs } = await import('viem')
  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs: receipt.logs,
  })

  const fromLower = params.fromAddress.toLowerCase()
  const toLower = params.toAddress.toLowerCase()
  const tokenLower = params.tokenAddress.toLowerCase()

  for (const ev of transfers) {
    if (ev.address.toLowerCase() !== tokenLower) continue
    const { from, to, value } = ev.args as {
      from: Address
      to: Address
      value: bigint
    }
    if (from.toLowerCase() !== fromLower || to.toLowerCase() !== toLower) continue
    if (value < params.minAmountRaw) {
      return { ok: false, error: 'transfer_amount_too_low' }
    }
    return { ok: true, amountRaw: value, blockNumber: receipt.blockNumber }
  }

  return { ok: false, error: 'transfer_log_not_found' }
}

/**
 * Custodial ERC-20 transfer for an arbitrary token (ops/treasury settlement helper).
 */
export async function transferEvmErc20Tokens(params: {
  senderWallet: Wallet
  tokenAddress: string
  toAddress: string
  amount: string
  decimals: number
  encryptionKey?: string
}): Promise<{ txHash: string }> {
  const encryptionKey = params.encryptionKey ?? process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  const token = params.tokenAddress as Address
  const value = parseUnits(params.amount, params.decimals)
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

  const { request } = await getPublicClient().simulateContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [params.toAddress as Address, value],
  })

  const txHash = await walletClient.writeContract(request)
  return { txHash }
}

/**
 * Ops/treasury send of configured RING ERC-20 (raw amount).
 * Used when chains.native=evm for treasury-swap settlement.
 * Requires EVM_TREASURY_PRIVATE_KEY + chains.evm.tokenAddress.
 */
export async function transferEvmRingRawFromOpsKey(params: {
  toAddress: string
  amountRaw: bigint
}): Promise<{ txHash: string; fromAddress: string }> {
  const opsKey = process.env.EVM_TREASURY_PRIVATE_KEY
  if (!opsKey) {
    throw new Error('evm_treasury_private_key_not_configured')
  }
  const token = getTransferTokenAddress()
  const account = privateKeyToAccount(
    (opsKey.startsWith('0x') ? opsKey : `0x${opsKey}`) as `0x${string}`,
  )
  const chainId = getEvmChainId()
  const walletClient = createWalletClient({
    account,
    chain: viemChainById(chainId),
    transport: http(getEvmRpcUrl()),
  })
  const { request } = await getPublicClient().simulateContract({
    account,
    address: token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [params.toAddress as Address, params.amountRaw],
  })
  const txHash = await walletClient.writeContract(request)
  return { txHash, fromAddress: account.address }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfer (unchanged below — uses private key, still Polygon-specific for the
// custodial send path; chain-configurable abstraction is TODO.)
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve configured EVM RING ERC-20 for custodial/ops transfers. */
function getTransferTokenAddress(): Address {
  const addr = getEvmChainTokenAddress()
  if (!addr) throw new Error('EVM token address not configured for transfers')
  return addr
}

// Memoized version of getEvmTokenBalance for optimal revalidation (React 19 cache)
// (moved up to line 77)

/**
 * Transfers configured EVM RING ERC-20 from a custodial user wallet (UI amount string).
 * Platform-native when chains.native is evm/base — not used for Solana SPL.
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
