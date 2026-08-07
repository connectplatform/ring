import 'server-only'

import { parseUnits, type Address } from 'viem'
import {
  getEvmTreasuryAddress,
  getNativeChain,
  getNativeTokenDecimals,
  getNativeTokenSwapAllowlist,
  getNativeTokenSymbol,
  isTreasurySwapPaused,
  getNativeChainConfig,
  type TreasurySwapAllowlistEntry,
} from '@/lib/ring-config-chain'
import {
  assertQuoteSlippage,
  getNativeTokenPerMainCurrencyRate,
  getMainCurrencyPriceFromFeed,
  signQuote,
  verifyQuoteToken,
  type SignedQuotePayload,
} from '@/lib/ring-oracle'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import {
  getEvmErc20Balance,
  verifyErc20TransferInTx,
} from '@/features/wallet/chains/evm/evm-token-transfer'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import { transferTokenFromTreasury } from '@/features/wallet/chains/solana/treasury-transfer-service'
import { nativeTokenRawToUi, nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { db, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { WalletChain } from '@/features/wallet/types'

const MAX_FEED_AGE_MS = 60 * 60 * 1000

function findAllowlistEntry(tokenAddress: string): TreasurySwapAllowlistEntry | undefined {
  const needle = tokenAddress.toLowerCase()
  return getNativeTokenSwapAllowlist().find((e) => e.address.toLowerCase() === needle)
}

/**
 * Price allowlisted ERC-20 in **main currency**.
 *
 * Chainlink feed is TOKEN/USD; facade `getMainCurrencyPriceFromFeed` bridges via
 * `getMainCurrencyToUsdRate()` (1 when main=USD).
 */
async function mainCurrencyFromAllowlistedToken(
  entry: TreasurySwapAllowlistEntry,
  amountIn: string,
): Promise<{
  tokenMainCurrencyPrice: string
  tokenChainlinkUsdPrice: string
  mainCurrencyNotional: string
}> {
  if (!entry.chainlinkFeed) {
    throw new Error('chainlink_feed_not_configured')
  }
  const chainId = getNativeChainConfig().evm?.chainId ?? 137
  const feed = await getMainCurrencyPriceFromFeed(entry.chainlinkFeed, chainId, {
    maxAgeMs: MAX_FEED_AGE_MS,
  })
  const tokenMainCurrencyPrice = feed.price
  const tokenChainlinkUsdPrice = feed.chainlinkUsdPrice ?? feed.price
  const amount = parseFloat(amountIn)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('invalid_amount')
  }
  const mainCurrencyNotional = (amount * parseFloat(tokenMainCurrencyPrice)).toFixed(8)
  return { tokenMainCurrencyPrice, tokenChainlinkUsdPrice, mainCurrencyNotional }
}

function assertCaps(mainCurrencyNotional: number): void {
  const evm = getNativeChainConfig().evm
  const maxTx = evm?.treasurySwapMaxMainCurrencyPerTx
  if (typeof maxTx === 'number' && maxTx > 0 && mainCurrencyNotional > maxTx) {
    throw new Error(`treasury_swap_exceeds_per_tx_cap_${maxTx}`)
  }
}

async function assertDailyCap(userId: string, mainCurrencyNotional: number): Promise<void> {
  const maxDay = getNativeChainConfig().evm?.treasurySwapMaxMainCurrencyPerDay
  if (typeof maxDay !== 'number' || maxDay <= 0) return

  await initializeDatabase()
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const result = await db().queryDocs<{
    metadata?: { usdNotional?: string; mainCurrencyNotional?: string }
  }>({
    collection: 'wallet_transactions',
    filters: [
      { field: 'userId', operator: '==', value: userId },
      { field: 'kind', operator: '==', value: 'treasury_swap_in' },
    ],
    pagination: { limit: 200 },
  })
  let spent = 0
  if (result.success && result.data) {
    for (const row of result.data) {
      const created = (row as { createdAt?: string }).createdAt
      if (created && new Date(created) < since) continue
      const n = parseFloat(
        row.metadata?.mainCurrencyNotional ?? row.metadata?.usdNotional ?? '0',
      )
      if (Number.isFinite(n)) spent += n
    }
  }
  if (spent + mainCurrencyNotional > maxDay) {
    throw new Error(`treasury_swap_exceeds_daily_cap_${maxDay}`)
  }
}

export type TreasurySwapQuoteResult = {
  quoteToken: string
  amountOut: string
  amountOutRaw: string
  /** Main currency per 1 native token (desk SSOT). */
  rate: string
  tokenMainCurrencyPrice: string
  tokenChainlinkUsdPrice: string
  mainCurrencyNotional: string
  expiresAt: number
  treasuryAddress: string
  fromTokenAddress: string
  symbol: string
  mainCurrency: string
}

/**
 * Flawless Swap (treasury_swap_in) — ERC-20 allowlist → custodial native token.
 *
 * ```
 * mainNotional = amountIn × getMainCurrencyPriceFromFeed(token)  // Chainlink USD ÷ mainToUsd
 * nativeOut    = mainNotional / getNativeTokenPerMainCurrencyRate()
 * ```
 *
 * Desk rate is fixed admin oracle (not DEX). Chainlink is only for allowlisted
 * inbound tokens — native token is never pool-priced.
 */
export async function quoteTreasurySwap(params: {
  userId: string
  fromTokenAddress: string
  amountIn: string
  signInAddress: string
}): Promise<TreasurySwapQuoteResult> {
  if (isTreasurySwapPaused()) {
    throw new Error('treasury_swap_paused')
  }
  const treasuryAddress = getEvmTreasuryAddress()
  if (!treasuryAddress) {
    throw new Error('evm_treasury_not_configured')
  }
  const entry = findAllowlistEntry(params.fromTokenAddress)
  if (!entry) {
    throw new Error('token_not_allowlisted')
  }

  const { tokenMainCurrencyPrice, tokenChainlinkUsdPrice, mainCurrencyNotional } =
    await mainCurrencyFromAllowlistedToken(entry, params.amountIn)
  const mainNotional = parseFloat(mainCurrencyNotional)
  assertCaps(mainNotional)
  await assertDailyCap(params.userId, mainNotional)

  const nativePerMain = await getNativeTokenPerMainCurrencyRate()
  const rate = parseFloat(nativePerMain)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('oracle_rate_invalid')
  }

  // nativeOut = mainNotional / (main per 1 native)
  const nativeUi = mainNotional / rate
  const decimals = getNativeTokenDecimals() ?? 8
  const ringAmountRaw = nativeTokenUiToRaw(nativeUi.toFixed(decimals), decimals).toString()
  const amountInRaw = parseUnits(params.amountIn, entry.decimals).toString()
  const chainId = getNativeChainConfig().evm?.chainId ?? 137
  const mainCurrency = getMainCurrencySymbol()

  const quoteToken = signQuote({
    side: 'treasury_swap_in',
    ringAmountRaw,
    creditBalanceAmount: '0',
    mainCurrencyNotional,
    rate: nativePerMain,
    discountBps: 0,
    fromTokenAddress: entry.address,
    amountInRaw,
    tokenChainlinkUsdPrice,
    signInAddress: params.signInAddress,
    chainId,
  })

  const payload = verifyQuoteToken(quoteToken)

  return {
    quoteToken,
    amountOut: nativeTokenRawToUi(BigInt(ringAmountRaw), decimals),
    amountOutRaw: ringAmountRaw,
    rate: nativePerMain,
    tokenMainCurrencyPrice,
    tokenChainlinkUsdPrice,
    mainCurrencyNotional,
    expiresAt: payload.expiresAt,
    treasuryAddress,
    fromTokenAddress: entry.address,
    symbol: entry.symbol,
    mainCurrency,
  }
}

async function settleNativeRingToCustodial(
  userId: string,
  ringAmountRaw: bigint,
): Promise<{ txHash: string; toAddress: string; chain: string }> {
  const native = getNativeChain()
  const wallet = await getNativeWallet(userId, native as WalletChain)
  if (!wallet?.address) {
    throw new Error('custodial_wallet_missing')
  }

  // Platform native SSOT: solana → SPL treasury; evm/base → RING ERC-20 ops key.
  if (native === 'solana') {
    const transfer = await transferTokenFromTreasury(wallet.address, ringAmountRaw)
    return { txHash: transfer.txHash, toAddress: wallet.address, chain: 'solana' }
  }

  const { transferEvmRingRawFromOpsKey } = await import(
    '@/features/wallet/chains/evm/evm-token-transfer'
  )
  const transfer = await transferEvmRingRawFromOpsKey({
    toAddress: wallet.address,
    amountRaw: ringAmountRaw,
  })
  return { txHash: transfer.txHash, toAddress: wallet.address, chain: native }
}

export type TreasurySwapExecuteResult = {
  success: true
  txHashIn: string
  txHashOut: string
  amountOut: string
  walletTransactionId: string
}

/**
 * After user transfers allowlisted ERC-20 to treasury (wagmi), verify receipt and settle RING.
 */
export async function executeTreasurySwap(params: {
  userId: string
  quoteToken: string
  depositTxHash: `0x${string}`
  signInAddress: string
}): Promise<TreasurySwapExecuteResult> {
  if (isTreasurySwapPaused()) {
    throw new Error('treasury_swap_paused')
  }

  const treasuryAddress = getEvmTreasuryAddress()
  if (!treasuryAddress) {
    throw new Error('evm_treasury_not_configured')
  }

  const payload = verifyQuoteToken(params.quoteToken)
  if (payload.side !== 'treasury_swap_in') {
    throw new Error('invalid_quote_side')
  }
  await assertQuoteSlippage(payload)

  if (
    !payload.fromTokenAddress ||
    !payload.amountInRaw ||
    !payload.signInAddress ||
    !payload.mainCurrencyNotional
  ) {
    throw new Error('quote_missing_swap_fields')
  }
  if (payload.signInAddress.toLowerCase() !== params.signInAddress.toLowerCase()) {
    throw new Error('sign_in_address_mismatch')
  }

  const entry = findAllowlistEntry(payload.fromTokenAddress)
  if (!entry) {
    throw new Error('token_not_allowlisted')
  }

  const idempotencyId = `treasury_swap_in_${params.depositTxHash.toLowerCase()}`
  await initializeDatabase()
  const existing = await db().findDocById('wallet_transactions', idempotencyId)
  if (existing.success && existing.data) {
    const row = existing.data as { txHash?: string; amount?: string; metadata?: { settleTxHash?: string } }
    return {
      success: true,
      txHashIn: params.depositTxHash,
      txHashOut: row.metadata?.settleTxHash ?? row.txHash ?? '',
      amountOut: row.amount ?? '',
      walletTransactionId: idempotencyId,
    }
  }

  const verified = await verifyErc20TransferInTx({
    txHash: params.depositTxHash,
    tokenAddress: payload.fromTokenAddress as Address,
    fromAddress: params.signInAddress as Address,
    toAddress: treasuryAddress as Address,
    minAmountRaw: BigInt(payload.amountInRaw),
  })
  if (verified.ok === false) {
    throw new Error(verified.error)
  }

  const mainNotional = parseFloat(payload.mainCurrencyNotional)
  if (!Number.isFinite(mainNotional) || mainNotional <= 0) {
    throw new Error('quote_main_currency_notional_invalid')
  }
  assertCaps(mainNotional)
  await assertDailyCap(params.userId, mainNotional)

  const ringRaw = BigInt(payload.ringAmountRaw)
  const settle = await settleNativeRingToCustodial(params.userId, ringRaw)
  const decimals = getNativeTokenDecimals() ?? 8
  const amountOut = nativeTokenRawToUi(ringRaw, decimals)

  const wtxId = await createWalletTransaction(
    {
      kind: 'treasury_swap_in',
      userId: params.userId,
      txHash: settle.txHash,
      fromAddress: params.signInAddress,
      toAddress: settle.toAddress,
      amount: amountOut,
      amountRaw: ringRaw.toString(),
      tokenSymbol: getNativeTokenSymbol(),
      chain: settle.chain,
      status: 'confirmed',
      metadata: {
        depositTxHash: params.depositTxHash,
        settleTxHash: settle.txHash,
        fromTokenAddress: payload.fromTokenAddress,
        amountInRaw: payload.amountInRaw,
        mainCurrencyNotional: payload.mainCurrencyNotional,
        tokenChainlinkUsdPrice: payload.tokenChainlinkUsdPrice,
        rate: payload.rate,
      },
    },
    idempotencyId,
  )

  logger.info('treasury_swap_in settled', {
    userId: params.userId,
    depositTxHash: params.depositTxHash,
    settleTxHash: settle.txHash,
    amountOut,
  })

  return {
    success: true,
    txHashIn: params.depositTxHash,
    txHashOut: settle.txHash,
    amountOut,
    walletTransactionId: wtxId,
  }
}

export type TreasuryDiversifyHealth = {
  ready: boolean
  reason?: string
  allowlistCount: number
  healthyFeeds: number
  feeds: Array<{ symbol: string; ok: boolean; error?: string; price?: string }>
}

export async function getTreasuryDiversifyHealth(): Promise<TreasuryDiversifyHealth> {
  const list = getNativeTokenSwapAllowlist()
  const chainId = getNativeChainConfig().evm?.chainId ?? 137
  const feeds: TreasuryDiversifyHealth['feeds'] = []
  let healthyFeeds = 0

  for (const entry of list) {
    if (!entry.chainlinkFeed) {
      feeds.push({ symbol: entry.symbol, ok: false, error: 'no_feed' })
      continue
    }
    try {
      const p = await getMainCurrencyPriceFromFeed(
        entry.chainlinkFeed,
        chainId,
        { maxAgeMs: MAX_FEED_AGE_MS },
      )
      healthyFeeds++
      feeds.push({ symbol: entry.symbol, ok: true, price: p.price })
    } catch (e) {
      feeds.push({
        symbol: entry.symbol,
        ok: false,
        error: e instanceof Error ? e.message : 'feed_error',
      })
    }
  }

  if (list.length < 2) {
    return {
      ready: false,
      reason: 'allowlist_requires_at_least_2',
      allowlistCount: list.length,
      healthyFeeds,
      feeds,
    }
  }
  if (healthyFeeds < 2) {
    return {
      ready: false,
      reason: 'oracle_feeds_unhealthy',
      allowlistCount: list.length,
      healthyFeeds,
      feeds,
    }
  }
  if (!getEvmTreasuryAddress()) {
    return {
      ready: false,
      reason: 'evm_treasury_not_configured',
      allowlistCount: list.length,
      healthyFeeds,
      feeds,
    }
  }

  return {
    ready: true,
    allowlistCount: list.length,
    healthyFeeds,
    feeds,
  }
}

export type DiversifyPlanLeg = {
  symbol: string
  address: string
  balance: string
  usd: number
  targetUsd: number
  deltaUsd: number
}

/**
 * Admin Diversify — equal-weight USD plan across allowlisted non-RING holdings.
 * Auto-execution requires EVM_TREASURY_SWAP_ROUTER; otherwise returns plan_only.
 */
export async function executeTreasuryDiversify(params: {
  adminUserId: string
}): Promise<{
  success: boolean
  error?: string
  status?: 'plan_only' | 'executed'
  plan?: DiversifyPlanLeg[]
  health?: TreasuryDiversifyHealth
}> {
  const health = await getTreasuryDiversifyHealth()
  if (!health.ready) {
    return {
      success: false,
      error: health.reason ?? 'treasury_diversify_not_ready',
      health,
    }
  }

  const treasury = getEvmTreasuryAddress()!
  const list = getNativeTokenSwapAllowlist()
  const legs: DiversifyPlanLeg[] = []
  let totalUsd = 0

  for (const entry of list) {
    const balance = await getEvmErc20Balance(entry.address, treasury, entry.decimals)
    const feed = health.feeds.find((f) => f.symbol === entry.symbol)
    const price = parseFloat(feed?.price ?? '0')
    const usd = parseFloat(balance) * price
    totalUsd += usd
    legs.push({
      symbol: entry.symbol,
      address: entry.address,
      balance,
      usd,
      targetUsd: 0,
      deltaUsd: 0,
    })
  }

  const targetEach = legs.length > 0 ? totalUsd / legs.length : 0
  for (const leg of legs) {
    leg.targetUsd = targetEach
    leg.deltaUsd = targetEach - leg.usd
  }

  await initializeDatabase()
  const auditKey = 'treasury_diversify'
  try {
    await db().updateDoc(
      'platform_settings',
      'web3',
      {
        diversifyLastPlan: {
          at: new Date().toISOString(),
          by: params.adminUserId,
          plan: legs,
        },
      },
      { merge: true },
    )
  } catch (e) {
    logger.warn('Failed to persist diversify plan', { error: e, auditKey })
  }

  if (!process.env.EVM_TREASURY_SWAP_ROUTER) {
    return {
      success: true,
      status: 'plan_only',
      plan: legs,
      health,
    }
  }

  // Router present — auto DEX rebalance is future work (security audit required).
  return {
    success: false,
    error: 'treasury_diversify_auto_exec_not_implemented',
    status: 'plan_only',
    plan: legs,
    health,
  }
}

/** @deprecated Prefer executeTreasuryDiversify — kept for stub path callers. */
export async function stubTreasuryDiversify(params: {
  adminUserId: string
}): Promise<{ success: boolean; error?: string; status?: string; plan?: DiversifyPlanLeg[] }> {
  return executeTreasuryDiversify(params)
}

/** @deprecated Client/API should use executeTreasurySwap after wagmi deposit. */
export async function stubSwapSignInTokenForNative(_params: {
  userId: string
  fromTokenAddress: `0x${string}`
  amount: string
}): Promise<{ success: false; error: string }> {
  return {
    success: false,
    error: 'use_treasury_swap_api',
  }
}
