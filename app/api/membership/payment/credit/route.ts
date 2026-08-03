/**
 * POST /api/membership/payment/credit
 * GET  /api/membership/payment/credit
 *
 * Credit-points membership via SubscriptionConductor (SSOT).
 * Amount = RING × credit.desk.creditBalanceUnitPerNativeToken (100 points for 1 RING).
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { getCreditUnitLabel } from '@/lib/ring-oracle'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'
import {
  getMembershipCreditAmountForPeriod,
  getMembershipMainCurrencyAmountForPeriod,
  getMembershipRingAmountForPeriod,
} from '@/lib/membership/pricing'
import { membershipPaymentTypeSchema } from '@/lib/zod/membership-schemas'

const CreditPaymentRequestSchema = z.object({
  type: membershipPaymentTypeSchema,
  auto_subscribe: z.boolean().default(true),
  billingPeriod: z.enum(['monthly', 'yearly']).optional().default('monthly'),
})

async function revalidateSafe(path: string) {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(path)
  } catch {
    // ignore
  }
}

export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email ?? ''
    const creditLabel = getCreditUnitLabel()

    const body = await request.json().catch(() => ({}))
    const parsed = CreditPaymentRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { type, auto_subscribe, billingPeriod } = parsed.data
    const period = billingPeriod === 'yearly' ? 'yearly' : 'monthly'
    const creditAmount = getMembershipCreditAmountForPeriod(period)
    const ringAmount = getMembershipRingAmountForPeriod(period)
    const mainCurrencyAmount = getMembershipMainCurrencyAmountForPeriod(period)
    const gwConfig = getGatewayConfig('credit_balance')

    const hasBalance = await creditBalanceService.hasSufficientBalance(
      userId,
      String(creditAmount),
    )
    if (!hasBalance) {
      const balance = await creditBalanceService.getUserCreditBalance(userId)
      return NextResponse.json(
        {
          error: 'Insufficient credit balance',
          current_balance: balance?.amount ?? '0',
          currency: creditLabel,
          required_amount: String(creditAmount),
          top_up_url: '/wallet/topup',
        },
        { status: 400 },
      )
    }

    // Conductor owns charge + ledger (no pre-spend double charge).
    if (type === 'subscription_renewal') {
      const renew = await SubscriptionConductor.renewSubscription(userId, 'credit_balance')
      if (!renew.success) {
        return NextResponse.json(
          { error: renew.error || 'Renewal failed' },
          { status: 400 },
        )
      }
      const after = await creditBalanceService.getUserCreditBalance(userId)
      revalidateSafe('/[locale]/wallet')
      revalidateSafe('/[locale]/profile')
      return NextResponse.json({
        success: true,
        message: `Membership renewal of ${creditAmount} ${creditLabel} processed`,
        payment: {
          type,
          amount_paid: String(creditAmount),
          currency: creditLabel,
          timestamp: Date.now(),
        },
        account: { new_balance: after?.amount ?? '0' },
      })
    }

    if (type === 'membership_fee') {
      const { getMainCurrencyCreditAccountingRate } = await import('@/lib/ring-oracle')
      const result = await creditBalanceService.processMembershipFee(
        userId,
        String(creditAmount),
        getMainCurrencyCreditAccountingRate(),
      )
      revalidateSafe('/[locale]/wallet')
      return NextResponse.json({
        success: true,
        message: `Membership fee of ${creditAmount} ${creditLabel} processed`,
        payment: {
          type,
          amount_paid: String(creditAmount),
          currency: creditLabel,
          transaction_id: result.transaction.id,
          timestamp: Date.now(),
        },
        account: {
          new_balance: (
            await creditBalanceService.getUserCreditBalance(userId)
          )?.amount,
        },
      })
    }

    // membership_upgrade
    const subResult = await SubscriptionConductor.createSubscription({
      userId,
      userEmail,
      provider: 'credit_balance',
      gateway: 'Credit Balance',
      method: 'credit_balance',
      amount: creditAmount,
      currency: creditLabel,
      gatewayFeePercent: gwConfig?.feePercent ?? 0,
      gatewayFeeFixed: gwConfig?.feeFixedCents ?? 0,
      metadata: {
        type,
        auto_renew: auto_subscribe,
        billingPeriod: period,
        ringAmount,
        mainCurrencyAmount,
        source: 'credit_balance_payment_api',
      },
    })

    if (!subResult.success) {
      return NextResponse.json(
        { error: subResult.error || 'Credit membership upgrade failed' },
        { status: 400 },
      )
    }

    const after = await creditBalanceService.getUserCreditBalance(userId)
    revalidateSafe('/[locale]/wallet')
    revalidateSafe('/[locale]/profile')

    logger.info('Credit balance membership payment processed', {
      userId,
      type,
      creditAmount,
      ringAmount,
      subscriptionId: subResult.subscriptionId,
    })

    return NextResponse.json({
      success: true,
      message: `Membership payment of ${creditAmount} ${creditLabel} processed via credit balance`,
      payment: {
        type,
        amount_paid: String(creditAmount),
        currency: creditLabel,
        native_token_amount: ringAmount,
        fiat_amount: mainCurrencyAmount,
        timestamp: Date.now(),
      },
      account: {
        new_balance: after?.amount ?? '0',
        subscription_id: subResult.subscriptionId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Credit membership payment failed', { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  await connection()
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const creditAmount = getMembershipCreditAmountForPeriod('monthly')
    const ringAmount = getMembershipRingAmountForPeriod('monthly')
    const mainCurrencyAmount = getMembershipMainCurrencyAmountForPeriod('monthly')
    const balance = await creditBalanceService.getUserCreditBalance(session.user.id)
    return NextResponse.json({
      success: true,
      pricing: {
        credit_points: creditAmount,
        native_token_amount: ringAmount,
        fiat_amount: mainCurrencyAmount,
        currency: getCreditUnitLabel(),
      },
      balance: balance?.amount ?? '0',
      sufficient: parseFloat(balance?.amount ?? '0') >= creditAmount,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 },
    )
  }
}
