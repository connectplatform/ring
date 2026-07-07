import 'server-only' // Ensures this file is server-only; prevents accidental client use in Next.js

// Service and utility imports for cross-cutting wallet/desk features
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import {
  assertQuoteSlippage,
  getRingPerUsdRate,
  signQuote,
  verifyQuoteToken,
  type SignedQuotePayload,
} from '@/features/wallet/services/ring-token-oracle'
import {
  getNativeChain,
  getTokenDeskConfig,
  getNativeTokenDecimals,
} from '@/lib/ring-config-chain'
import { applyBps, nativeTokenRawToUi, nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { screenWalletAddress } from '@/lib/wallet/compliance-guard'
import {
  createDeskOrder,
  findDeskOrderByIdempotencyKey,
  updateDeskOrderStatus,
} from '@/lib/wallet/desk-order-db'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import {
  burnTokenFromUser,
  transferTokenFromTreasury,
  transferTokenToTreasury,
} from '@/features/wallet/chains/solana/treasury-transfer-service'
import type { DeskOrderSide } from '@/lib/zod/desk-schemas'
import { db } from '@/lib/database'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import type { TokenDeskConfig } from '@/lib/ring-config-types'
import { getClientCreditFiatCurrency } from '@/lib/ring-config-client'

/**
 * Converts a raw RING amount (bigint) to its USD amount at a given rate.
 * @param ringRaw - The raw amount of RING tokens
 * @param rate - String representation of RING per USD conversion rate
 * @returns {string} USD amount
 */
function usdFromRingRaw(ringRaw: bigint, rate: string): string {
  const ringPerUsd = parseFloat(rate)
  if (!ringPerUsd) return '0'
  // Converts ringRaw from base units (bigint) to UI units (float string)
  const ringUi = parseFloat(nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8))
  return (ringUi / ringPerUsd).toFixed(8)
}

/**
 * Converts a USD amount (string) to its RING raw integer using a rate.
 * @param usd - USD amount
 * @param rate - String representation of RING per USD
 * @returns {bigint} RING raw value
 */
function ringRawFromUsd(usd: string, rate: string): bigint {
  const ringPerUsd = parseFloat(rate)
  const usdNum = parseFloat(usd)
  if (!ringPerUsd || !usdNum) return 0n
  const ringUi = (usdNum * ringPerUsd).toFixed(8)
  return nativeTokenUiToRaw(ringUi, getNativeTokenDecimals() ?? 8)
}

/**
 * Quotes a desk order for buying or selling RING.
 * Computes conversion using the desk config and validates the amount.
 */
export async function quoteDesk(params: {
  userId: string
  side: DeskOrderSide
  amount: string
}): Promise<{
  side: DeskOrderSide
  ringAmountRaw: string
  ringAmountUi: string
  creditUsd: string
  creditFiatCurrency: string
  rate: string
  discountBps: number
  quoteToken: string
}> {
  // Prevent use on non-Solana chains, as desk only operates for Solana
  if (getNativeChain() !== 'solana') {
    throw new Error('Desk is only available when Solana is the native chain')
  }

  const rate = await getRingPerUsdRate() // Fetch latest RING/USD rate
  const desk = getTokenDeskConfig() // Desk config object (contains BPS, etc.)
  let discountBps = 0 // TODO: Implement a logic to set discountBps for certain users or scenarios

  let ringAmountRaw: bigint
  let creditUsd: string

  if (params.side === 'buy') {
    // User wants to buy RING using USD input
    creditUsd = parseFloat(params.amount).toFixed(8)
    // Validation: buy amount must be greater than 0
    if (parseFloat(creditUsd) <= 0) {
      throw new Error('Buy amount must be positive USD')
    } else {
      ringAmountRaw = ringRawFromUsd(creditUsd, rate)
    }
  } else {
    // User wants to sell RING (input is in RING)
    ringAmountRaw = nativeTokenUiToRaw(params.amount, getNativeTokenDecimals() ?? 8)
    // Validation: sell amount must be greater than 0
    if (ringAmountRaw <= 0n) {
      throw new Error('Sell amount must be positive RING')
    }
    // Compute gross USD value for tokens
    const grossUsd = usdFromRingRaw(ringAmountRaw, rate)
    const taxBps = (desk as TokenDeskConfig).sellTaxBps ?? 0
    // Computes "tax" in USD terms
    const taxUsd = (parseFloat(grossUsd) * (taxBps / 10_000)).toFixed(8) as unknown as string // TODO: Fix this type assertion (see below)
    creditUsd = (parseFloat(grossUsd) - parseFloat(taxUsd)).toFixed(8)
    // TODO: Refactor this to avoid unsafe type assertion; ensure taxUsd is a string after computation
  }

  // Generate a signed quote token with the offer details
  const quoteToken = signQuote({
    side: params.side,
    ringAmountRaw: ringAmountRaw.toString(),
    creditUsd,
    rate,
    discountBps,
  })

  // Return quote details, using client-currency getter for fiat denomination
  return {
    side: params.side,
    ringAmountRaw: ringAmountRaw.toString(),
    ringAmountUi: nativeTokenRawToUi(ringAmountRaw, getNativeTokenDecimals() ?? 8),
    creditUsd,
    creditFiatCurrency: getClientCreditFiatCurrency(),
    rate,
    discountBps,
    quoteToken,
  }
}

/**
 * Settles a desk order, ensuring idempotency by idempotencyKey and calling the appropriate buy/sell path.
 */
export async function executeDesk(params: {
  userId: string
  idempotencyKey: string
  quoteToken: string
}): Promise<{ orderId: string; status: string; txHash?: string }> {
  // Check for existing desk order with same idempotencyKey (idempotent endpoint)
  const existing = await findDeskOrderByIdempotencyKey(params.idempotencyKey)
  if (existing?.id) {
    // If already exists, return its info for non-repeating effect
    return {
      orderId: existing.id,
      status: existing.status,
      txHash: existing.chain_signature,
    }
  }

  // Verify the provided quote token and assert it's still within the allowed price slippage
  const payload = verifyQuoteToken(params.quoteToken)
  await assertQuoteSlippage(payload)

  // Fetch user's Solana wallet, must exist for desk actions
  const wallet = await getNativeWallet(params.userId, 'solana')
  if (!wallet?.address) {
    throw new Error('Solana wallet required for desk settlement')
  }

  // Run compliance (e.g., sanctions) checks on the wallet address
  const screen = await screenWalletAddress(wallet.address, params.userId)
  if (!screen.allowed) {
    throw new Error(`Compliance rejected: ${'reasonCode' in screen ? screen.reasonCode : 'blocked'}`)
  }

  // Create a pending desk order (db stub)
  const order = await createDeskOrder({
    idempotency_key: params.idempotencyKey,
    user_id: params.userId,
    side: payload.side,
    status: 'pending',
    quote_token: params.quoteToken,
    ring_amount_raw: payload.ringAmountRaw,
    credit_amount_usd: payload.creditUsd,
    first_settler_discount_applied: payload.discountBps > 0,
  })

  // Route buy/sell to appropriate helper
  if (payload.side === 'buy') {
    return executeDeskBuy(params.userId, wallet, order.id!, payload)
  }

  return executeDeskSell(params.userId, wallet, order.id!, payload)
}

/**
 * Internal: Executes a desk buy. Deducts fiat, updates order status, transfers RING to user.
 */
async function executeDeskBuy(
  userId: string,
  wallet: Awaited<ReturnType<typeof getNativeWallet>>,
  orderId: string,
  payload: SignedQuotePayload,
) {
  const ringRaw = BigInt(payload.ringAmountRaw)

  try {
    // Withdraw USD balance from user for buy
    await creditBalanceService.spendFiatUsd(
      userId,
      payload.creditUsd,
      `Desk buy ${nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8)} RING`,
      'desk_buy',
      { desk_order_id: orderId },
    )
    // Mark order as having held fiat
    await updateDeskOrderStatus(orderId, 'credit_held')
    // Now ready to submit chain-side (move tokens)
    await updateDeskOrderStatus(orderId, 'chain_submitted')

    // Transfer RING from treasury to user wallet on chain
    const transfer = await transferTokenFromTreasury(wallet!.address, ringRaw)
    // Log transaction in app's wallet transaction table
    const wtxId = await createWalletTransaction({
      kind: 'desk_buy',
      userId,
      txHash: transfer.txHash,
      fromAddress: transfer.fromAddress,
      toAddress: wallet!.address,
      amount: nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8),
      tokenSymbol: getNativeTokenSymbol(),
      chain: 'solana',
      deskOrderId: orderId,
    })

    // Mark order as settled, include chain signature and wallet txn details
    await updateDeskOrderStatus(orderId, 'settled', {
      chain_signature: transfer.txHash,
      wallet_transaction_id: wtxId,
    })

    // If first-settler discount triggered, update user's profile
    if (payload.discountBps > 0) {
      const desk = getTokenDeskConfig()
      if (desk.firstSettlerOneTime !== false) {
        // Flag user as having taken first-settler discount to avoid repeated application
        await db().updateDoc('users', userId, { deskFirstSettlerConsumed: true }, { merge: true })
      }
    }

    // Success; return order id & chain tx hash
    return { orderId, status: 'settled', txHash: transfer.txHash }
  } catch (error) {
    // Rollback for any kind of desk/buy-processing failure
    const message = error instanceof Error ? error.message : 'Desk buy failed'
    await updateDeskOrderStatus(orderId, 'failed', { failure_reason: message })

    // Best-effort: Refund USD if possible (even if transfer fails)
    try {
      await creditBalanceService.addFiatUsd(
        userId,
        payload.creditUsd,
        'Desk buy refund (chain failure)',
        'desk_refund',
        { desk_order_id: orderId },
      )
      await updateDeskOrderStatus(orderId, 'refunded')
    } catch {
      /* compensating refund best-effort; this can be improved for full ACID rollback */
    }

    throw error // Let caller handle as needed
  }
}

/**
 * Internal: Executes a desk sell. Burns or taxes tokens, issues credit, logs db.
 */
async function executeDeskSell(
  userId: string,
  wallet: NonNullable<Awaited<ReturnType<typeof getNativeWallet>>>,
  orderId: string,
  payload: SignedQuotePayload,
) {
  const desk = getTokenDeskConfig()
  const ringRaw = BigInt(payload.ringAmountRaw)
  // Compute tax in raw tokens. Default 0 if not set.
  const taxRaw = applyBps(ringRaw, (desk as TokenDeskConfig).sellTaxBps ?? 0)
  // The remaining tokens to burn
  const burnRaw = ringRaw - taxRaw

  try {
    // Mark order as processing on-chain; record how much tax is assessed in RING
    await updateDeskOrderStatus(orderId, 'chain_submitted', {
      sell_tax_ring_raw: taxRaw.toString(),
    })

    // If any "tax" exists AND config wants it sent to treasury, transfer now
    if (taxRaw > 0n && (desk as TokenDeskConfig).sellTaxDestination === 'treasury_ata') {
      await transferTokenToTreasury(wallet, taxRaw)
    }

    // Burn the user's input tokens for the desk sell
    if (burnRaw > 0n) {
      await burnTokenFromUser(wallet, burnRaw)
    }

    // Add the USD credit to user for successful sell
    await creditBalanceService.addFiatUsd(
      userId,
      payload.creditUsd,
      `Desk sell ${nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8)} RING`,
      'desk_sell',
      { desk_order_id: orderId },
    )

    // Create a wallet transaction record for the sell
    const wtxId = await createWalletTransaction({
      kind: 'desk_sell',
      userId,
      fromAddress: wallet.address,
      amount: nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8),
      tokenSymbol: getNativeTokenSymbol(),
      chain: 'solana',
      deskOrderId: orderId,
    })

    // Mark desk order as settled in the db
    await updateDeskOrderStatus(orderId, 'settled', { wallet_transaction_id: wtxId })

    // Success; return confirmation
    return { orderId, status: 'settled' }
  } catch (error) {
    // On any failure, mark as failed and propagate error
    const message = error instanceof Error ? error.message : 'Desk sell failed'
    await updateDeskOrderStatus(orderId, 'failed', { failure_reason: message })
    throw error
  }
}

// TODO: For Next.js 13/14+ and React 19: 
// - Consider refactoring `getNativeWallet`, `getRingPerUsdRate` and other user/config fetches to leverage server component async calls and React's use hook conventions for data fetching in server actions.
// - Where applicable, rewrite to use Next.js's new server actions for state-changing functions (e.g., for desk buys/sells from the UI).
// - Refactor API-level database state handling with server-side mutations & optimistic UI patterns for faster user experience.
// - For type safety, address the unsafe `as unknown as string` assertion for taxUsd—refactor to ensure number and fix string conversion properly with utility function.