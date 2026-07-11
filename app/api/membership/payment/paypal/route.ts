import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { logger } from '@/lib/logger'
import { getMembershipRingUpgradeAmount, getMembershipRingRenewalAmount } from '@/lib/membership/pricing'

/**
 * PayPal payment request schema.
 *
 * Handles PayPal payments for membership tiers.
 * For fiat USD credit balance payments, use /api/membership/payment/credit.
 * For on-chain native token payments, use /api/membership/payment/token.
 * For card payments, use /api/membership/payment/card.
 */
const PayPalPaymentRequestSchema = z.object({
  type: z.enum(['membership_upgrade', 'subscription_renewal', 'membership_fee']),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number').optional(),
  auto_subscribe: z.boolean().default(true), // PayPal payments default to subscription
})

type PayPalPaymentRequest = z.infer<typeof PayPalPaymentRequestSchema>

/**
 * POST /api/membership/payment/paypal
 * Process membership fee payment via PayPal.
 *
 * SSOT: PayPal integration is currently a stub (Phase S7).
 * This endpoint handles:
 * - membership_upgrade: Upgrade from SUBSCRIBER to MEMBER via PayPal
 * - subscription_renewal: Renew existing subscription via PayPal
 * - membership_fee: One-time payment without subscription via PayPal
 *
 * PayPal payments default to auto_subscribe=true (recurring billing).
 */
export async function POST(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const userEmail = session.user.email || ''
    const requestBody = await request.json()

    // Validate request body
    let validatedRequest: PayPalPaymentRequest
    try {
      validatedRequest = PayPalPaymentRequestSchema.parse(requestBody)
    } catch (validationError) {
      logger.warn('Invalid PayPal payment request', {
        userId,
        requestBody,
        validationError
      })

      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      )
    }

    const { type, amount, auto_subscribe } = validatedRequest

    const defaultUpgradeAmount = getMembershipRingUpgradeAmount()
    const defaultRenewalAmount = getMembershipRingRenewalAmount()
    const membershipFee =
      amount ??
      (type === 'subscription_renewal'
        ? defaultRenewalAmount.toString()
        : defaultUpgradeAmount.toString())
    const paymentAmount = parseFloat(membershipFee)

    // Validate payment amount
    if (paymentAmount <= 0 || paymentAmount > 100) {
      return NextResponse.json(
        {
          error: `Invalid payment amount. Must be between 0.01 and 100 USD`,
        },
        { status: 400 }
      )
    }

    // SSOT: route through SubscriptionConductor paypal provider (Phase S8 stub)
    // and PaymentConductor paypal processor — no parallel hardcoded 501 path.
    if (type === 'subscription_renewal') {
      const renewal = await SubscriptionConductor.renewSubscription(userId, 'paypal')
      return NextResponse.json(
        {
          error: renewal.error || 'PayPal integration not yet implemented',
          code: 'PAYPAL_NOT_IMPLEMENTED',
          message:
            'PayPal payment processing is currently in development (Phase S8). Please use credit balance, native token, or card payment.',
          available_providers: ['credit_balance', 'native_token', 'stripe', 'wayforpay'],
        },
        { status: 501 }
      )
    }

    const { PaymentConductor } = await import('@/lib/payments/conductor/payment-conductor')
    const checkout = await PaymentConductor.createCheckout({
      purpose: 'membership_upgrade',
      userId,
      userEmail,
      entityId: userId,
      amount: paymentAmount,
      currency: 'USD',
      returnUrl: '',
      metadata: { processor: 'paypal', type, auto_subscribe },
    })

    if (!checkout.success) {
      // Also probe SubscriptionConductor so ledger provider stays SSOT when PayPal goes live
      if (auto_subscribe) {
        const sub = await SubscriptionConductor.createSubscription({
          userId,
          userEmail,
          provider: 'paypal',
          gateway: 'paypal',
          method: 'paypal',
          amount: paymentAmount,
          currency: 'USD',
          gatewayFeePercent: 0,
          gatewayFeeFixed: 0,
          metadata: { source: 'paypal_payment', type },
        })
        return NextResponse.json(
          {
            error: checkout.error || sub.error || 'PayPal integration not yet implemented',
            code: checkout.code || 'PAYPAL_NOT_IMPLEMENTED',
            message:
              'PayPal payment processing is currently in development (Phase S8). Please use credit balance, native token, or card payment.',
            available_providers: ['credit_balance', 'native_token', 'stripe', 'wayforpay'],
          },
          { status: 501 }
        )
      }

      return NextResponse.json(
        {
          error: checkout.error || 'PayPal integration not yet implemented',
          code: checkout.code || 'PAYPAL_NOT_IMPLEMENTED',
          message:
            'PayPal payment processing is currently in development (Phase S8). Please use credit balance, native token, or card payment.',
          available_providers: ['credit_balance', 'native_token', 'stripe', 'wayforpay'],
        },
        { status: 501 }
      )
    }

    return NextResponse.json({
      success: true,
      paymentUrl: checkout.paymentUrl,
      orderReference: checkout.orderReference,
    })

  } catch (error) {
    logger.error('Failed to process PayPal payment', { error })

    return NextResponse.json(
      { error: 'Failed to process PayPal payment' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/membership/payment/paypal
 * Get PayPal payment information and pricing.
 */
export async function GET(request: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const membershipFee = getMembershipRingUpgradeAmount()

    const response = {
      status: 'not_implemented',
      message: 'PayPal integration is currently in development (Phase S8)',
      conductor: {
        payment: 'PaymentConductor.createCheckout({ metadata.processor: paypal })',
        subscription: 'SubscriptionConductor provider paypal (Phase S8 stub)',
      },
      provider: {
        name: 'paypal',
        supported_methods: ['paypal_account'],
        supported_currencies: ['USD', 'EUR', 'GBP'],
      },
      pricing: {
        membership_fee: {
          amount: membershipFee.toFixed(2),
          currency: 'USD',
        },
        fees: {
          processing_fee: '3.49% + $0.49', // Typical PayPal fees
          platform_fee: '0',
        },
      },
      available_alternatives: [
        {
          provider: 'credit_balance',
          endpoint: '/api/membership/payment/credit',
          description: 'Pay with fiat USD credit balance',
        },
        {
          provider: 'native_token',
          endpoint: '/api/membership/payment/token',
          description: 'Pay with on-chain RING token (gasless)',
        },
        {
          provider: 'stripe',
          endpoint: '/api/membership/payment/card',
          description: 'Pay with credit/debit card via Stripe',
        },
        {
          provider: 'wayforpay',
          endpoint: '/api/membership/payment/card',
          description: 'Pay with credit/debit card via WayForPay',
        },
      ],
      roadmap: {
        phase: 'S8',
        status: 'in_development',
        features: [
          'PayPal order creation',
          'PayPal approval redirect',
          'PayPal webhook handling',
          'SubscriptionConductor paypal provider (live)',
          'PaymentConductor paypal.processor (live)',
        ],
      },
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to get PayPal payment information', { error })

    return NextResponse.json(
      { error: 'Failed to retrieve payment information' },
      { status: 500 }
    )
  }
}
