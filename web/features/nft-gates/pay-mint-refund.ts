/**
 * RING pay→mint refund recovery — treasury → user ATA after mint failure.
 * Idempotent by paySignature / purchaseId (never double-refund).
 */

import 'server-only'

import { db, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'
import { getNativeTokenAddress } from '@/lib/ring-config-chain'
import { transferTokenFromTreasury } from '@/features/wallet/chains/solana/treasury-transfer-service'
import type { NftGateSlug } from './types'

export type NftGatePurchaseStatus =
  | 'payment_confirmed'
  | 'mint_failed_refund_pending'
  | 'refund_submitted'
  | 'refund_confirmed'
  | 'mint_succeeded'
  | 'refund_failed'

export type NftGatePurchaseRecord = {
  id: string
  purchaseId: string
  userId: string
  slug: NftGateSlug
  userWallet: string
  treasury: string
  ringMint?: string
  rawAmount: string
  decimals: number
  priceRing: number
  paySignature: string
  mintSignature?: string
  mintAsset?: string
  mintError?: string
  refundSignature?: string
  refundError?: string
  status: NftGatePurchaseStatus
  attemptCount: number
  createdAt: string
  updatedAt: string
}

function nowIso() {
  return new Date().toISOString()
}

function purchaseDocId(purchaseId: string): string {
  return `ngp_${purchaseId}`
}

export async function findPurchaseByPaySignature(
  paySignature: string,
): Promise<NftGatePurchaseRecord | null> {
  await initializeDatabase()
  const result = await db().queryDocs<NftGatePurchaseRecord & Record<string, unknown>>({
    collection: 'nft_gate_purchases',
    filters: [{ field: 'paySignature', operator: '==', value: paySignature }],
    pagination: { limit: 1 },
  })
  if (!result.success || !result.data?.length) return null
  return result.data[0] as NftGatePurchaseRecord
}

export async function persistPaymentConfirmed(params: {
  purchaseId: string
  userId: string
  slug: NftGateSlug
  userWallet: string
  treasury: string
  rawAmount: string
  decimals: number
  priceRing: number
  paySignature: string
}): Promise<NftGatePurchaseRecord> {
  await initializeDatabase()
  const ts = nowIso()
  const record: NftGatePurchaseRecord = {
    id: purchaseDocId(params.purchaseId),
    purchaseId: params.purchaseId,
    userId: params.userId,
    slug: params.slug,
    userWallet: params.userWallet,
    treasury: params.treasury,
    ringMint: getNativeTokenAddress() || undefined,
    rawAmount: params.rawAmount,
    decimals: params.decimals,
    priceRing: params.priceRing,
    paySignature: params.paySignature,
    status: 'payment_confirmed',
    attemptCount: 0,
    createdAt: ts,
    updatedAt: ts,
  }
  const created = await db().createDoc('nft_gate_purchases', record, { id: record.id })
  if (!created.success) {
    throw created.error || new Error('Failed to persist nft_gate_purchases payment_confirmed')
  }
  return record
}

export async function markMintSucceeded(params: {
  purchaseId: string
  mintAsset: string
  mintSignature?: string
}): Promise<void> {
  await initializeDatabase()
  const id = purchaseDocId(params.purchaseId)
  await db().updateDoc(
    'nft_gate_purchases',
    id,
    {
      status: 'mint_succeeded' satisfies NftGatePurchaseStatus,
      mintAsset: params.mintAsset,
      mintSignature: params.mintSignature,
      updatedAt: nowIso(),
    },
    { merge: true },
  )
}

/**
 * On mint failure: mark refund_pending (idempotent), then treasury→user RING refund.
 * Returns existing refundSignature if already refunded for this paySignature.
 */
export async function refundAfterMintFailure(params: {
  purchaseId: string
  paySignature: string
  userWallet: string
  rawAmount: string
  mintError?: string
}): Promise<{
  success: boolean
  refundSignature?: string
  purchaseId: string
  paySignature: string
  error?: string
  alreadyRefunded?: boolean
}> {
  await initializeDatabase()
  const id = purchaseDocId(params.purchaseId)

  const existing =
    (await db().readDoc<NftGatePurchaseRecord>('nft_gate_purchases', id)).data ||
    (await findPurchaseByPaySignature(params.paySignature))

  if (existing?.refundSignature) {
    logger.info('refundAfterMintFailure: idempotent hit', {
      purchaseId: params.purchaseId,
      paySignature: params.paySignature,
      refundSignature: existing.refundSignature,
    })
    return {
      success: true,
      refundSignature: existing.refundSignature,
      purchaseId: params.purchaseId,
      paySignature: params.paySignature,
      alreadyRefunded: true,
    }
  }

  const attemptCount = (existing?.attemptCount ?? 0) + 1
  await db().updateDoc(
    'nft_gate_purchases',
    id,
    {
      status: 'mint_failed_refund_pending' satisfies NftGatePurchaseStatus,
      mintError: params.mintError,
      attemptCount,
      updatedAt: nowIso(),
    },
    { merge: true },
  )

  try {
    const raw = BigInt(params.rawAmount)
    const refund = await transferTokenFromTreasury(params.userWallet, raw)

    await db().updateDoc(
      'nft_gate_purchases',
      id,
      {
        status: 'refund_confirmed' satisfies NftGatePurchaseStatus,
        refundSignature: refund.txHash,
        updatedAt: nowIso(),
      },
      { merge: true },
    )

    logger.info('refundAfterMintFailure: refund confirmed', {
      purchaseId: params.purchaseId,
      paySignature: params.paySignature,
      refundSignature: refund.txHash,
      rawAmount: params.rawAmount,
    })

    return {
      success: true,
      refundSignature: refund.txHash,
      purchaseId: params.purchaseId,
      paySignature: params.paySignature,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db().updateDoc(
      'nft_gate_purchases',
      id,
      {
        status: 'refund_failed' satisfies NftGatePurchaseStatus,
        refundError: message,
        attemptCount,
        updatedAt: nowIso(),
      },
      { merge: true },
    )
    logger.error('refundAfterMintFailure: refund failed', {
      purchaseId: params.purchaseId,
      paySignature: params.paySignature,
      error: message,
    })
    return {
      success: false,
      purchaseId: params.purchaseId,
      paySignature: params.paySignature,
      error: message,
    }
  }
}
