import 'server-only'

import { logger } from '@/lib/logger'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { transferTokenFromTreasury } from '@/features/wallet/chains/solana/treasury-transfer-service'

/**
 * Native-token refund recovery — treasury → user after a confirmed native payment.
 *
 * Idempotent by orderReference (never double-refunds; mirrors the nft-gates
 * refund machine, simplified onto the unified payment_transactions ledger):
 *   - paid row → treasury→user transfer → status 'refunded' + refund tx in processor_payload
 *   - already refunded → replay existing refundTxHash
 *   - transfer failure → row stays 'paid' (retryable), error returned to caller
 *
 * Scope (v1): full-amount refunds only, minimal ledger (payment_transactions
 * `refunded` status). No subscription_ledger / store-order flip — exception path,
 * admin reconciles manually.
 */

export type NativeRefundResult =
  | { success: true; refundTxHash: string; alreadyRefunded?: boolean }
  | { success: false; error: string; code?: string }

/** Resolve refund amount (raw units) from the paid row. */
function resolveRefundAmountRaw(row: {
  processor_payload?: Record<string, unknown>
  amount_minor?: number
}): { raw: bigint; uiAmount: string } | null {
  const payload = row.processor_payload ?? {}
  const tokenAmount = payload.tokenAmount
  if (typeof tokenAmount === 'string' && tokenAmount.trim()) {
    const raw = nativeTokenUiToRaw(tokenAmount.trim())
    if (raw > 0n) return { raw, uiAmount: tokenAmount.trim() }
  }
  if (typeof row.amount_minor === 'number' && row.amount_minor > 0) {
    return { raw: BigInt(row.amount_minor), uiAmount: (row.amount_minor / 1e6).toString() }
  }
  return null
}

export async function refundNativePayment(params: {
  orderReference: string
  requestedBy: string
  reason?: string
}): Promise<NativeRefundResult> {
  const { orderReference, requestedBy, reason } = params

  const row = await paymentTransactionService.findByOrderReference(orderReference)
  if (!row) {
    return { success: false, error: 'Payment not found', code: 'NOT_FOUND' }
  }
  if (row.processor !== 'native_token') {
    return {
      success: false,
      error: `Payment processor is ${row.processor} — native refund applies to native_token rows only`,
      code: 'NOT_NATIVE_PAYMENT',
    }
  }
  if (row.status === 'refunded') {
    const existing = (row.processor_payload as { refundTxHash?: string } | undefined)?.refundTxHash
    logger.info('refundNativePayment: idempotent hit', { orderReference, refundTxHash: existing })
    return {
      success: true,
      refundTxHash: existing ?? '',
      alreadyRefunded: true,
    }
  }
  if (row.status !== 'paid') {
    return {
      success: false,
      error: `Only paid payments can be refunded (current status: ${row.status})`,
      code: 'NOT_PAID',
    }
  }

  if (!row.user_id) {
    return { success: false, error: 'Payment row has no user_id — cannot resolve refund destination', code: 'NO_USER' }
  }

  const wallet = await getNativeWallet(row.user_id, 'solana')
  if (!wallet) {
    return { success: false, error: 'User has no Solana native wallet — refund destination unavailable', code: 'NO_WALLET' }
  }

  const amount = resolveRefundAmountRaw(row)
  if (!amount) {
    return { success: false, error: 'Unable to resolve refund amount from payment row', code: 'NO_AMOUNT' }
  }

  try {
    const refund = await transferTokenFromTreasury(wallet.address, amount.raw)

    await paymentTransactionService.appendStatus(orderReference, 'refunded', {
      processor_payload: {
        refundTxHash: refund.txHash,
        refundReason: reason ?? 'Admin refund',
        refundedBy: requestedBy,
        refundedAt: new Date().toISOString(),
        refundAmountUi: amount.uiAmount,
      },
    })

    logger.info('refundNativePayment: refund confirmed', {
      orderReference,
      userId: row.user_id,
      refundTxHash: refund.txHash,
      amountUi: amount.uiAmount,
      requestedBy,
    })

    return { success: true, refundTxHash: refund.txHash }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund transfer failed'
    logger.error('refundNativePayment: refund failed (row stays paid, retryable)', {
      orderReference,
      userId: row.user_id,
      error: message,
    })
    return { success: false, error: message }
  }
}