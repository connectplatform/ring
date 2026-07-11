import 'server-only'

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
  getNativeTokenSymbol,
} from '@/lib/ring-config-chain'
import { nativeTokenRawToUi, nativeTokenUiToRaw } from '@/lib/wallet/native-token-amount'
import { screenWalletAddress } from '@/lib/wallet/compliance-guard'
import {
  createDeskOrder,
  findDeskOrderByIdempotencyKey,
  updateDeskOrderStatus,
} from '@/lib/wallet/desk-order-db'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import { transferTokenFromTreasury } from '@/features/wallet/chains/solana/treasury-transfer-service'
import type { DeskOrderSide } from '@/lib/zod/desk-schemas'
import { db } from '@/lib/database'
import { getClientCreditFiatCurrency } from '@/lib/ring-config-client'
import { getFiatCreditAccountingRate } from '@/lib/payments/credit-currency'

/** Credit point → defaultCurrency multiplier (ring-config credit.unitToDefaultCurrency). */
function getPointFiatValue(): number {
  return Number(getFiatCreditAccountingRate()) || 1
}

export class DeskInsufficientCreditError extends Error {
  readonly code = 'INSUFFICIENT_CREDIT' as const
  constructor(message = 'INSUFFICIENT_CREDIT') {
    super(message)
    this.name = 'DeskInsufficientCreditError'
  }
}

/**
 * Quotes a desk buy: credit points → native token via live oracle.
 *
 * With pointFiatValue = 1 (1 point ≡ 1 default-fiat unit), token fiat price is
 * the oracle rate itself (fiat units per 1 native token). Example: rate 100 →
 * 100 points = 1 RING.
 *
 * nativeOut = (points × pointFiatValue) / ringPerUsd
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
  if (getNativeChain() !== 'solana') {
    throw new Error('Desk is only available when Solana is the native chain')
  }

  if (params.side !== 'buy') {
    throw new Error('Token desk only supports credit→native conversion (buy)')
  }

  const points = Math.floor(parseFloat(params.amount))
  if (!Number.isFinite(points) || points <= 0) {
    throw new Error('Buy amount must be a positive whole number of credit points')
  }

  const ringPerUsd = parseFloat(await getRingPerUsdRate())
  if (!Number.isFinite(ringPerUsd) || ringPerUsd <= 0) {
    throw new Error('Oracle rate unavailable')
  }

  const fiat = points * getPointFiatValue()
  const ringUi = (fiat / ringPerUsd).toFixed(8)
  const ringAmountRaw = nativeTokenUiToRaw(ringUi, getNativeTokenDecimals() ?? 8)
  if (ringAmountRaw <= 0n) {
    throw new Error('Converted native token amount is too small')
  }

  const creditPoints = String(points)
  const discountBps = 0
  const quoteToken = signQuote({
    side: 'buy',
    ringAmountRaw: ringAmountRaw.toString(),
    creditUsd: creditPoints,
    rate: String(ringPerUsd),
    discountBps,
  })

  return {
    side: 'buy',
    ringAmountRaw: ringAmountRaw.toString(),
    ringAmountUi: nativeTokenRawToUi(ringAmountRaw, getNativeTokenDecimals() ?? 8),
    creditUsd: creditPoints,
    creditFiatCurrency: getClientCreditFiatCurrency(),
    rate: String(ringPerUsd),
    discountBps,
    quoteToken,
  }
}

export async function executeDesk(params: {
  userId: string
  idempotencyKey: string
  quoteToken: string
}): Promise<{ orderId: string; status: string; txHash?: string }> {
  const existing = await findDeskOrderByIdempotencyKey(params.idempotencyKey)
  if (existing?.id) {
    return {
      orderId: existing.id,
      status: existing.status,
      txHash: existing.chain_signature,
    }
  }

  const payload = verifyQuoteToken(params.quoteToken)
  if (payload.side !== 'buy') {
    throw new Error('Token desk only supports credit→native conversion (buy)')
  }
  await assertQuoteSlippage(payload)

  const wallet = await getNativeWallet(params.userId, 'solana')
  if (!wallet?.address) {
    throw new Error('Solana wallet required for desk settlement')
  }

  const screen = await screenWalletAddress(wallet.address, params.userId)
  if (!screen.allowed) {
    throw new Error(`Compliance rejected: ${'reasonCode' in screen ? screen.reasonCode : 'blocked'}`)
  }

  // Subscriber+ gate lives in WalletConductor.quoteDesk/executeDesk (SSOT).

  const pointsNeeded = Math.floor(parseFloat(payload.creditUsd))
  const hasEnough = await creditBalanceService.hasSufficientBalance(
    params.userId,
    String(pointsNeeded),
  )
  if (!hasEnough) {
    throw new DeskInsufficientCreditError('INSUFFICIENT_CREDIT')
  }

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

  return executeDeskBuy(params.userId, wallet, order.id!, payload)
}

async function executeDeskBuy(
  userId: string,
  wallet: Awaited<ReturnType<typeof getNativeWallet>>,
  orderId: string,
  payload: SignedQuotePayload,
) {
  const ringRaw = BigInt(payload.ringAmountRaw)
  let creditsDebited = false

  try {
    await creditBalanceService.spendFiatUsd(
      userId,
      payload.creditUsd,
      `Desk buy ${nativeTokenRawToUi(ringRaw, getNativeTokenDecimals() ?? 8)} ${getNativeTokenSymbol()}`,
      'desk_buy',
      { desk_order_id: orderId },
    )
    creditsDebited = true
    await updateDeskOrderStatus(orderId, 'credit_held')
    await updateDeskOrderStatus(orderId, 'chain_submitted')

    const transfer = await transferTokenFromTreasury(wallet!.address, ringRaw)
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

    await updateDeskOrderStatus(orderId, 'settled', {
      chain_signature: transfer.txHash,
      wallet_transaction_id: wtxId,
    })

    if (payload.discountBps > 0) {
      const desk = getTokenDeskConfig()
      if (desk.firstSettlerOneTime !== false) {
        await db().updateDoc('users', userId, { deskFirstSettlerConsumed: true }, { merge: true })
      }
    }

    return { orderId, status: 'settled', txHash: transfer.txHash }
  } catch (error) {
    if (error instanceof DeskInsufficientCreditError) {
      await updateDeskOrderStatus(orderId, 'failed', { failure_reason: error.message })
      throw error
    }

    const message = error instanceof Error ? error.message : 'Desk buy failed'
    await updateDeskOrderStatus(orderId, 'failed', { failure_reason: message })

    // Refund only after a successful debit (never invent credits on pre-debit failures)
    if (creditsDebited) {
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
        /* compensating refund best-effort */
      }
    }

    throw error
  }
}
