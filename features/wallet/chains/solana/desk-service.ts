import 'server-only'

import { userCreditService } from '@/features/wallet/services/user-credit-service'
import {
  assertQuoteSlippage,
  getRingPerUsdRate,
  signQuote,
  verifyQuoteToken,
  type SignedQuotePayload,
} from '@/features/wallet/services/ring-token-oracle'
import {
  getNativeChain,
  getRingCreditFiatCurrency,
  getRingDeskConfig,
} from '@/lib/ring-config-chain'
import { applyBps, ringRawToUi, ringUiToRaw } from '@/lib/wallet/ring-amount'
import { screenWalletAddress } from '@/lib/wallet/compliance-guard'
import {
  createDeskOrder,
  findDeskOrderByIdempotencyKey,
  updateDeskOrderStatus,
} from '@/lib/wallet/desk-order-db'
import { createWalletTransaction } from '@/lib/wallet/wallet-transaction-db'
import { getNativeWallet } from '@/lib/wallet/user-wallet-db'
import {
  burnRingFromUser,
  transferRingFromTreasury,
  transferRingToTreasury,
} from '@/features/wallet/chains/solana/treasury-transfer-service'
import type { DeskOrderSide } from '@/lib/zod/desk-schemas'
import { db } from '@/lib/database'

function usdFromRingRaw(ringRaw: bigint, rate: string): string {
  const ringPerUsd = parseFloat(rate)
  if (!ringPerUsd) return '0'
  const ringUi = parseFloat(ringRawToUi(ringRaw))
  return (ringUi / ringPerUsd).toFixed(8)
}

function ringRawFromUsd(usd: string, rate: string): bigint {
  const ringPerUsd = parseFloat(rate)
  const usdNum = parseFloat(usd)
  if (!ringPerUsd || !usdNum) return 0n
  const ringUi = (usdNum * ringPerUsd).toFixed(8)
  return ringUiToRaw(ringUi)
}

async function userEligibleForFirstSettler(userId: string): Promise<boolean> {
  const desk = getRingDeskConfig()
  if (!desk.firstSettlerDiscountBps) return false

  const userResult = await db().readDoc<Record<string, unknown>>('users', userId)
  const data = (userResult.data ?? {}) as Record<string, unknown>
  if (data.deskFirstSettlerConsumed === true) return false

  const gates = desk.firstSettlerGates ?? []
  if (gates.includes('wallet')) {
    const wallet = await getNativeWallet(userId, 'solana')
    if (!wallet?.address) return false
  }
  if (gates.includes('username') && !data.username) return false
  if (gates.includes('verified') && !data.isVerified) return false
  if (gates.includes('dob') && !data.dateOfBirth && !data.birthDate) return false

  return true
}

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

  const rate = await getRingPerUsdRate()
  const desk = getRingDeskConfig()
  let discountBps = 0

  let ringAmountRaw: bigint
  let creditUsd: string

  if (params.side === 'buy') {
    creditUsd = parseFloat(params.amount).toFixed(8)
    if (parseFloat(creditUsd) <= 0) {
      throw new Error('Buy amount must be positive USD')
    }

    if (await userEligibleForFirstSettler(params.userId)) {
      discountBps = desk.firstSettlerDiscountBps ?? 0
      const discountedUsd = (
        parseFloat(creditUsd) *
        (1 - discountBps / 10_000)
      ).toFixed(8)
      ringAmountRaw = ringRawFromUsd(discountedUsd, rate)
      creditUsd = parseFloat(creditUsd).toFixed(8)
    } else {
      ringAmountRaw = ringRawFromUsd(creditUsd, rate)
    }
  } else {
    ringAmountRaw = ringUiToRaw(params.amount)
    if (ringAmountRaw <= 0n) {
      throw new Error('Sell amount must be positive RING')
    }
    const grossUsd = usdFromRingRaw(ringAmountRaw, rate)
    const taxBps = desk.sellTaxBps ?? 0
    const taxUsd = (parseFloat(grossUsd) * (taxBps / 10_000)).toFixed(8)
    creditUsd = (parseFloat(grossUsd) - parseFloat(taxUsd)).toFixed(8)
  }

  const quoteToken = signQuote({
    side: params.side,
    ringAmountRaw: ringAmountRaw.toString(),
    creditUsd,
    rate,
    discountBps,
  })

  return {
    side: params.side,
    ringAmountRaw: ringAmountRaw.toString(),
    ringAmountUi: ringRawToUi(ringAmountRaw),
    creditUsd,
    creditFiatCurrency: getRingCreditFiatCurrency(),
    rate,
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
  await assertQuoteSlippage(payload)

  const wallet = await getNativeWallet(params.userId, 'solana')
  if (!wallet?.address) {
    throw new Error('Solana wallet required for desk settlement')
  }

  const screen = await screenWalletAddress(wallet.address, params.userId)
  if (!screen.allowed) {
    throw new Error(`Compliance rejected: ${'reasonCode' in screen ? screen.reasonCode : 'blocked'}`)
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

  if (payload.side === 'buy') {
    return executeDeskBuy(params.userId, wallet, order.id!, payload)
  }

  return executeDeskSell(params.userId, wallet, order.id!, payload)
}

async function executeDeskBuy(
  userId: string,
  wallet: Awaited<ReturnType<typeof getNativeWallet>>,
  orderId: string,
  payload: SignedQuotePayload,
) {
  const ringRaw = BigInt(payload.ringAmountRaw)

  try {
    await userCreditService.spendFiatUsd(
      userId,
      payload.creditUsd,
      `Desk buy ${ringRawToUi(ringRaw)} RING`,
      'desk_buy',
      { desk_order_id: orderId },
    )
    await updateDeskOrderStatus(orderId, 'credit_held')
    await updateDeskOrderStatus(orderId, 'chain_submitted')

    const transfer = await transferRingFromTreasury(wallet!.address, ringRaw)
    const wtxId = await createWalletTransaction({
      kind: 'desk_buy',
      userId,
      txHash: transfer.txHash,
      fromAddress: transfer.fromAddress,
      toAddress: wallet!.address,
      amount: ringRawToUi(ringRaw),
      tokenSymbol: 'RING',
      chain: 'solana',
      deskOrderId: orderId,
    })

    await updateDeskOrderStatus(orderId, 'settled', {
      chain_signature: transfer.txHash,
      wallet_transaction_id: wtxId,
    })

    if (payload.discountBps > 0) {
      const desk = getRingDeskConfig()
      if (desk.firstSettlerOneTime !== false) {
        await db().updateDoc('users', userId, { deskFirstSettlerConsumed: true }, { merge: true })
      }
    }

    return { orderId, status: 'settled', txHash: transfer.txHash }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Desk buy failed'
    await updateDeskOrderStatus(orderId, 'failed', { failure_reason: message })

    try {
      await userCreditService.addFiatUsd(
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

    throw error
  }
}

async function executeDeskSell(
  userId: string,
  wallet: NonNullable<Awaited<ReturnType<typeof getNativeWallet>>>,
  orderId: string,
  payload: SignedQuotePayload,
) {
  const desk = getRingDeskConfig()
  const ringRaw = BigInt(payload.ringAmountRaw)
  const taxRaw = applyBps(ringRaw, desk.sellTaxBps ?? 0)
  const burnRaw = ringRaw - taxRaw

  try {
    await updateDeskOrderStatus(orderId, 'chain_submitted', {
      sell_tax_ring_raw: taxRaw.toString(),
    })

    if (taxRaw > 0n && desk.sellTaxDestination === 'treasury_ata') {
      await transferRingToTreasury(wallet, taxRaw)
    }

    if (burnRaw > 0n) {
      await burnRingFromUser(wallet, burnRaw)
    }

    await userCreditService.addFiatUsd(
      userId,
      payload.creditUsd,
      `Desk sell ${ringRawToUi(ringRaw)} RING`,
      'desk_sell',
      { desk_order_id: orderId },
    )

    const wtxId = await createWalletTransaction({
      kind: 'desk_sell',
      userId,
      fromAddress: wallet.address,
      amount: ringRawToUi(ringRaw),
      tokenSymbol: 'RING',
      chain: 'solana',
      deskOrderId: orderId,
    })

    await updateDeskOrderStatus(orderId, 'settled', { wallet_transaction_id: wtxId })

    return { orderId, status: 'settled' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Desk sell failed'
    await updateDeskOrderStatus(orderId, 'failed', { failure_reason: message })
    throw error
  }
}
