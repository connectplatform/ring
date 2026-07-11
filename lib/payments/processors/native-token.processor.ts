import 'server-only'

import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { isRailEnabled, getNativeTokenConfig } from '@/lib/payments/payment.config'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import {
  getNativeTokenBalanceForUser,
  transferNativeTokenForUser,
} from '@/features/wallet/chains/native-token-transfer-service'
import { getNativeTokenTreasuryAddress, getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { getRingPerUsdRate } from '@/features/wallet/services/ring-token-oracle'
import { logger } from '@/lib/logger'

/**
 * Resolve fiat order total → native token amount.
 * Prefer explicit metadata.tokenAmount; else convert via RING/USD oracle
 * (same desk convention: 1 fiat unit ≈ 1 USD until FX engine ships).
 */
async function resolveTokenAmount(ctx: CreateCheckoutContext): Promise<{
  tokenAmount: string
  error?: string
}> {
  const explicit = ctx.metadata?.tokenAmount
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    const n = Number(explicit)
    if (!Number.isFinite(n) || n <= 0) {
      return { tokenAmount: '0', error: 'Invalid metadata.tokenAmount' }
    }
    return { tokenAmount: String(explicit) }
  }

  if (!Number.isFinite(ctx.amount) || ctx.amount <= 0) {
    return { tokenAmount: '0', error: 'Invalid order amount' }
  }

  try {
    const ringPerUsd = Number(await getRingPerUsdRate())
    if (!Number.isFinite(ringPerUsd) || ringPerUsd <= 0) {
      return { tokenAmount: '0', error: 'Native token oracle rate unavailable' }
    }
    // Desk SSOT: nativeOut = fiatPoints / ringPerUsd (POINT_FIAT_VALUE=1).
    // Example: 100 USD-equivalent points at ringPerUsd=100 → 1 RING.
    const tokenAmount = (ctx.amount / ringPerUsd).toFixed(6)
    return { tokenAmount }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Oracle conversion failed'
    return { tokenAmount: '0', error: message }
  }
}

/**
 * Synchronous store/membership checkout via on-chain native token transfer to treasury.
 * Mirrors internal-credit.processor: createPending → transfer → markPaid.
 */
export async function createNativeTokenCheckout(
  ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  if (!isRailEnabled(ctx.purpose, 'native_token')) {
    return {
      success: false,
      error: 'Native token rail is disabled (set PAYMENT_STORE_ALLOW_TOKEN=true for store_order)',
      code: 'NATIVE_TOKEN_RAIL_DISABLED',
    }
  }

  const treasuryAddress = getNativeTokenTreasuryAddress()
  if (!treasuryAddress || treasuryAddress === 'RING') {
    return {
      success: false,
      error: 'NATIVE_TOKEN_TREASURY_ADDRESS is not configured',
      code: 'TREASURY_NOT_CONFIGURED',
    }
  }

  const resolved = await resolveTokenAmount(ctx)
  if (resolved.error || !resolved.tokenAmount) {
    return { success: false, error: resolved.error ?? 'Unable to resolve token amount' }
  }
  const tokenAmount = resolved.tokenAmount
  const tokenSymbol = getNativeTokenSymbol()

  const orderReference = buildOrderReference(ctx.purpose, {
    orderId: ctx.orderId ?? ctx.entityId,
    userId: ctx.userId,
    articleId: ctx.articleId ?? ctx.entityId,
  })

  await paymentTransactionService.createPending({
    purpose: ctx.purpose,
    processor: 'native-token',
    rail: 'native_token',
    orderReference,
    entityType: ctx.purpose,
    entityId: ctx.entityId,
    userId: ctx.userId,
    amountMinor: Math.round(Number(tokenAmount) * 1e6),
    currency: tokenSymbol,
  })

  try {
    const balance = await getNativeTokenBalanceForUser(ctx.userId)
    if (parseFloat(balance.balance) < parseFloat(tokenAmount)) {
      return {
        success: false,
        error: `Insufficient ${tokenSymbol} balance`,
        code: 'INSUFFICIENT_TOKEN_BALANCE',
        orderReference,
      }
    }

    const transfer = await transferNativeTokenForUser({
      userId: ctx.userId,
      toAddress: treasuryAddress,
      amount: tokenAmount,
    })

    await paymentTransactionService.markPaid(orderReference, {
      rail: 'native_token',
      txHash: transfer.txHash,
      fromAddress: transfer.fromAddress,
      toAddress: treasuryAddress,
      tokenAmount,
      tokenSymbol,
      fiatAmount: ctx.amount,
      fiatCurrency: ctx.currency,
      contractAddress: getNativeTokenConfig().contractAddress,
    })

    return {
      success: true,
      paid: true,
      orderReference,
      txHash: transfer.txHash,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Native token payment failed'
    logger.error('createNativeTokenCheckout failed', {
      userId: ctx.userId,
      orderReference,
      error: message,
    })
    return { success: false, error: message, orderReference }
  }
}
