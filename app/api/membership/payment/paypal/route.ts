import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { logger } from '@/lib/logger'
import type { MembershipBillingPeriod } from '@/lib/membership/pricing'
import { getLiveMemberMainCurrencyTierForPeriod } from '@/lib/membership/pricing-live'
import { getPayPalGatewayCurrency } from '@/lib/payments/processors/paypal-client'
import { convertFromMainCurrency } from '@/lib/ring-oracle'
import { membershipApiPaymentBodySchema } from '@/lib/zod/membership-schemas'

/**
 * PayPal membership payment — shared membership API body schema.
 */
const PayPalPaymentRequestSchema = membershipApiPaymentBodySchema
type PayPalPaymentRequest = z.infer<typeof PayPalPaymentRequestSchema>

/**
 * POST /api/membership/payment/paypal
 * Membership fee via PaymentConductor (processor paypal) + SubscriptionConductor provider paypal.
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

    const { type, amount, auto_subscribe, billingPeriod } = validatedRequest
    const period = billingPeriod as MembershipBillingPeriod
    const currency = getPayPalGatewayCurrency()

    // Price is always server-derived from the live desk oracle; the client-sent
    // `amount` is advisory display only and must never set what we charge.
    const fiatTier = await getLiveMemberMainCurrencyTierForPeriod(period)
    const paymentAmount = Number(convertFromMainCurrency(fiatTier.amount, currency).toFixed(2))

    if (amount !== undefined && Math.abs(parseFloat(amount) - paymentAmount) > 0.01) {
      logger.warn('PayPal membership: client amount differs from live desk price', {
        userId,
        clientAmount: amount,
        serverAmount: paymentAmount,
        currency,
      })
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 1_000_000) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }

    // SSOT: PaymentConductor paypal processor + SubscriptionConductor paypal provider
    if (type === 'subscription_renewal') {
      const existing = await SubscriptionConductor.getSubscription(userId)
      const renewal = await SubscriptionConductor.renewSubscription(
        userId,
        'paypal',
        existing?.paypal_subscription_id,
      )
      if (!renewal.success) {
        return NextResponse.json(
          {
            error: renewal.error || 'PayPal renewal failed',
            code: 'PAYPAL_RENEW_FAILED',
            message:
              'PayPal renew is webhook-driven. Use a new membership_upgrade checkout or wait for SALE.COMPLETED.',
            available_providers: ['credit_balance', 'native_token', 'stripe', 'wayforpay', 'paypal'],
          },
          { status: 400 },
        )
      }
      return NextResponse.json({ success: true, ...renewal })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ring-platform.org'
    const returnUrl = `${baseUrl}/membership/manage?status=paypal_return`

    const sub = await SubscriptionConductor.createSubscription({
      userId,
      userEmail,
      provider: 'paypal',
      gateway: 'paypal',
      method: 'paypal',
      amount: paymentAmount,
      currency,
      gatewayFeePercent: 2.9,
      gatewayFeeFixed: 0.3,
      returnUrl,
      metadata: {
        source: 'paypal_payment',
        type,
        auto_subscribe,
        returnUrl,
        billingPeriod: period,
      },
    })

    if (!sub.success || !sub.redirectUrl) {
      const { PaymentConductor } = await import('@/lib/payments/conductor/payment-conductor')
      const checkout = await PaymentConductor.createCheckout({
        purpose: 'membership_upgrade',
        rail: 'paypal',
        userId,
        userEmail,
        entityId: userId,
        amount: paymentAmount,
        currency,
        returnUrl,
        metadata: { processor: 'paypal', type, auto_subscribe, billingPeriod: period },
      })

      if (!checkout.success || !checkout.paymentUrl) {
        return NextResponse.json(
          {
            error: sub.error || checkout.error || 'PayPal checkout failed',
            code: checkout.code || 'PAYPAL_CHECKOUT_FAILED',
            message: sub.error || checkout.error || 'Unable to start PayPal checkout',
            available_providers: ['credit_balance', 'native_token', 'stripe', 'wayforpay', 'paypal'],
          },
          { status: 400 },
        )
      }

      return NextResponse.json({
        success: true,
        paymentUrl: checkout.paymentUrl,
        orderReference: checkout.orderReference,
      })
    }

    return NextResponse.json({
      success: true,
      paymentUrl: sub.redirectUrl,
      orderReference: sub.gatewayReference || sub.subscriptionId,
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

    const paypalCurrency = getPayPalGatewayCurrency()
    const fiatTier = await getLiveMemberMainCurrencyTierForPeriod('monthly')

    const { isPayPalCredentialsConfigured } = await import('@/lib/payments/processors/paypal-client')
    const live = isPayPalCredentialsConfigured()

    const response = {
      status: live ? 'live' : 'credentials_missing',
      message: live
        ? 'PayPal Orders v2 via PaymentConductor is available'
        : 'Set PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (and WEBHOOK_ID) to enable PayPal',
      conductor: {
        payment: 'PaymentConductor.createCheckout({ rail: paypal })',
        subscription: 'SubscriptionConductor provider paypal',
        webhook: 'POST /api/payments/paypal/webhook',
      },
      provider: {
        name: 'paypal',
        supported_methods: ['paypal_account'],
        supported_currencies: ['USD', 'EUR'],
      },
      pricing: {
        membership_fee: {
          amount: convertFromMainCurrency(fiatTier.amount, paypalCurrency).toFixed(2),
          currency: paypalCurrency,
        },
        fees: {
          processing_fee: '2.9% + $0.30 (ring-config payment.gateways.paypal)',
          platform_fee: '0',
        },
      },
      available_alternatives: [
        {
          provider: 'credit_balance',
          endpoint: '/api/membership/payment/credit',
          description: 'Pay with credit units (points)',
        },
        {
          provider: 'native_token',
          endpoint: '/api/membership/payment/token',
          description: 'Pay with on-chain native token',
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
