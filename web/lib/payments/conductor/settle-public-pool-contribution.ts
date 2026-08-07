import 'server-only'

import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getPublicPoolConfig } from '@/lib/ring-config-core'
import {
  createContribution,
  findPoolBySlug,
  findContributionByIdempotency,
} from '@/features/public-pools/lib/public-pool-db'
import {
  recomputePoolTotals,
} from '@/features/public-pools/services/public-pool-service'

/**
 * Settle a paid card/fiat public-pool contribution (TD-MONEY-01).
 * Idempotent via payment orderReference as contribution idempotency_key.
 * Does NOT route native-token donate through PaymentConductor.
 */
export async function settlePublicPoolCardContribution(params: {
  orderReference: string
  userId: string
  poolSlug: string
  amountNativeToken: string
  processor: string
}): Promise<boolean> {
  const amountNativeToken = String(params.amountNativeToken || '').trim()
  if (!amountNativeToken || !(parseFloat(amountNativeToken) > 0)) {
    logger.error('settlePublicPoolCardContribution: invalid amountNativeToken', params)
    return false
  }

  const { cloneId } = getPublicPoolConfig()
  const pool = await findPoolBySlug(cloneId, params.poolSlug)
  if (!pool) {
    logger.error('settlePublicPoolCardContribution: pool not found', {
      poolSlug: params.poolSlug,
    })
    return false
  }

  if (pool.status === 'completed' || pool.status === 'cancelled') {
    logger.error('settlePublicPoolCardContribution: pool closed', {
      poolSlug: params.poolSlug,
      status: pool.status,
    })
    return false
  }

  const existing = await findContributionByIdempotency(cloneId, params.orderReference)
  if (existing?.status === 'confirmed') {
    logger.info('settlePublicPoolCardContribution: already settled', {
      orderReference: params.orderReference,
    })
    return true
  }

  if (!existing) {
    await createContribution({
      clone_id: cloneId,
      pool_id: pool.id,
      user_id: params.userId,
      amount_native: amountNativeToken,
      funding_mode: 'donation',
      status: 'confirmed',
      idempotency_key: params.orderReference,
      chain: 'solana',
      rail: 'card',
      tx_hash: `card:${params.processor}:${params.orderReference}`,
    })
  }

  await recomputePoolTotals(pool.id)

  try {
    const { refreshOpenDaoJarMessages } = await import(
      '@/features/chat/lib/refresh-open-dao-jar-messages'
    )
    await refreshOpenDaoJarMessages(params.poolSlug, {
      contributorUserId: params.userId,
      lastContribution: {
        userId: params.userId,
        amountNativeToken,
        rail: 'card',
        at: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.warn('settlePublicPoolCardContribution: jar refresh skipped', { error })
  }

  logger.info('settlePublicPoolCardContribution: settled', {
    orderReference: params.orderReference,
    poolSlug: params.poolSlug,
    amountNativeToken,
  })

  return true
}

/** Resolve amount_native from payment tx metadata (preferred) or desk-oracle mainCurrency→nativeToken. */
export async function amountNativeTokenFromPaidTx(orderReference: string): Promise<{
  userId: string
  poolSlug: string
  amountNativeToken: string
} | null> {
  const tx = await paymentTransactionService.findByOrderReference(orderReference)
  if (!tx?.user_id) return null

  const meta = (tx.metadata ?? {}) as Record<string, unknown>
  const poolSlug = String(meta.poolSlug ?? meta.publicPoolSlug ?? '').trim()
  const amountNativeToken = String(
    meta.amountNativeToken ?? meta.amount_native ?? '',
  ).trim()

  if (!poolSlug) return null

  if (amountNativeToken && parseFloat(amountNativeToken) > 0) {
    return { userId: tx.user_id, poolSlug, amountNativeToken }
  }

  const mainCurrency =
    typeof tx.amount_minor === 'number' ? tx.amount_minor / 100 : 0
  if (mainCurrency <= 0) return null

  try {
    const { mainCurrencyToNativeTokenUiWithMeta } = await import('@/lib/ring-oracle')
    const converted = await mainCurrencyToNativeTokenUiWithMeta(mainCurrency)
    return {
      userId: tx.user_id,
      poolSlug,
      amountNativeToken: converted.nativeUi,
    }
  } catch (error) {
    logger.error('amountNativeTokenFromPaidTx: desk oracle failed', {
      orderReference,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export function newCardContributionIdempotencyKey(): string {
  return randomUUID()
}
