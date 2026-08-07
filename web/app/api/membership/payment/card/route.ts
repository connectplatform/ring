import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { logger } from '@/lib/logger'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { getMembershipRingRenewalAmount } from '@/lib/membership/pricing'
import {
  getLiveMemberMainCurrencyTierForPeriod,
  getLiveMembershipMainCurrencyAmountForNative,
} from '@/lib/membership/pricing-live'
import { getCardPaymentProcessor } from '@/lib/payments/subscription/subscription-config'
import { membershipApiPaymentBodySchema } from '@/lib/zod/membership-schemas'

// ==========================
// CARD PAYMENT API ENDPOINTS
// ==========================

const CardPaymentRequestSchema = membershipApiPaymentBodySchema
type CardPaymentRequest = z.infer<typeof CardPaymentRequestSchema>

/**
 * POST /api/membership/payment/card
 * Process membership fee payment via card (Stripe/WayForPay).
 * Handles:
 *   - membership_upgrade: Card upgrade from SUBSCRIBER to MEMBER
 *   - subscription_renewal: Card based renewal
 *   - membership_fee: One-time card payment (typically creates subscription)
 *
 * Card payments default to recurring unless auto_subscribe is explicitly false.
 */
// TODO: Next.js 16: Once it is stable, refactor to new Route Handler pattern for /api endpoints (using export { POST, GET }).
export async function POST(request: NextRequest) {
  // NOTE: opt out of prerendering by registering DB connection, required for DB/session-based endpoints
  await connection()

  try {
    // Authenticate and authorize user session
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

    // -------------------------
    // Body validation (zod)
    // -------------------------
    let validatedRequest: CardPaymentRequest
    try {
      validatedRequest = CardPaymentRequestSchema.parse(requestBody)
    } catch (validationError) {
      // Capture validation errors and log for debugging/future alerting
      logger.warn('Invalid card payment request', {
        userId,
        requestBody,
        validationError
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      )
    }

    const { type, amount, provider, auto_subscribe } = validatedRequest

    // -------------------------
    // Payment Provider Detection
    // -------------------------
    // Use explicit provider override if present, else use default from config
    // TODO: For dynamic per-request/feature providers, pull from context or user settings.
    const cardProvider = provider || getCardPaymentProcessor()
    if (!cardProvider) {
      // No payment processor configured at all (should never happen in prod)
      return NextResponse.json(
        {
          error: 'No card payment processor configured',
          message: 'ring-config.json → payment.cardPaymentProcessor is required',
        },
        { status: 503 }
      )
    }

    // -------------------------
    // Pricing & Fee Calculation
    // -------------------------
    // Card charges are always the live desk main-currency price derived on the
    // server. The client-sent `amount` is advisory display only — never trusted.
    const upgradeTier = await getLiveMemberMainCurrencyTierForPeriod('monthly')
    const paymentAmount =
      type === 'subscription_renewal'
        ? await getLiveMembershipMainCurrencyAmountForNative(getMembershipRingRenewalAmount())
        : upgradeTier.amount
    const paymentCurrency = upgradeTier.currency
    const membershipFee = paymentAmount.toFixed(2)

    if (amount !== undefined && Math.abs(parseFloat(amount) - paymentAmount) > 0.01) {
      logger.warn('Card membership: client amount differs from live desk price', {
        userId,
        clientAmount: amount,
        serverAmount: paymentAmount,
        currency: paymentCurrency,
      })
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 1_000_000) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // -------------------------
    // Payment Processing Switch
    // -------------------------
    // Handles different POST use-cases via type
    let subscriptionResult   // will store result of conductor action, if any
    let responseMessage      // for user-facing response

    switch (type) {
      case 'membership_upgrade': {
        // ================
        // MEMBERSHIP UPGRADE LOGIC
        // ================
        // Only SUBSCRIBERs can upgrade—they become MEMBER by paying.
        if (session.user.role !== UserRolesArray.subscriber as UserRolesArray) {
          return NextResponse.json(
            {
              error: 'Invalid upgrade request',
              message: 'Only Subscribers can upgrade to Member using card payment',
              current_role: session.user.role,
            },
            { status: 400 }
          )
        }

        if (auto_subscribe) {
          // Subscription-based upgrade (recommended flow for cards)
          // TODO: When implementing additional recurring methods, factor these fields out to config layer
          subscriptionResult = await SubscriptionConductor.createSubscription({
            userId,
            userEmail,
            provider: cardProvider,
            gateway: cardProvider === 'stripe' ? 'Stripe' : 'WayForPay',
            method: 'card',
            amount: paymentAmount,
            currency: paymentCurrency,
            gatewayFeePercent: cardProvider === 'stripe' ? 2.9 : 2.7, // Stripe/WayForPay fee
            gatewayFeeFixed: cardProvider === 'stripe' ? 0.30 : 0,
            metadata: {
              source: 'card_payment',
              auto_renew: true,
              target_role: UserRolesArray.member as UserRolesArray,
            },
          })

          // If payment provider failed or denied, bail early and signal error
          if (!subscriptionResult.success) {
            logger.warn('SubscriptionConductor.createSubscription failed', {
              userId,
              provider: cardProvider,
              error: subscriptionResult.error,
            })
            return NextResponse.json(
              { error: subscriptionResult.error || 'Failed to create subscription' },
              { status: 400 }
            )
          }
          responseMessage = 'Upgraded to Member and created automatic subscription'
        } else {
          // One-time, non-subscription upgrade by card: generally unused, but valid
          // TODO: This pathway could be tied to future single-month-only membership products.
          responseMessage = 'Upgraded to Member tier successfully'
          // MOCK CODE, TODO: Process card one-time upgrade (without actual sub - possibly notify ops or front-end about unsupported single-pay)
        }
        break
      }

      case 'subscription_renewal': {
        // ================
        // SUBSCRIPTION RENEWAL LOGIC
        // ================
        // User is renewing a previously active (possibly expired) sub via card
        // This endpoint CLI renews active subscription via Conductor logic.
        // TODO: In future, attach invoice record/receipt for the transaction
        subscriptionResult = await SubscriptionConductor.renewSubscription(
          userId,
          cardProvider,
        )

        if (!subscriptionResult.success) {
          return NextResponse.json(
            { error: subscriptionResult.error || 'Renewal failed' },
            { status: 400 }
          )
        }

        responseMessage = 'Subscription renewed successfully'
        break
      }

      case 'membership_fee': {
        // ================
        // MEMBERSHIP FEE, "One-Time" Payment LOGIC
        // ================
        // For most cards, this is still a subscription, but allow opt-out via auto_subscribe
        if (auto_subscribe) {
          // Recurring
          subscriptionResult = await SubscriptionConductor.createSubscription({
            userId,
            userEmail,
            provider: cardProvider,
            gateway: cardProvider === 'stripe' ? 'Stripe' : 'WayForPay',
            method: 'card',
            amount: paymentAmount,
            currency: paymentCurrency,
            gatewayFeePercent: cardProvider === 'stripe' ? 2.9 : 2.7,
            gatewayFeeFixed: cardProvider === 'stripe' ? 0.30 : 0,
            metadata: {
              source: 'card_payment',
              auto_renew: true,
              target_role: UserRolesArray.member as UserRolesArray,
            },
          })

          if (!subscriptionResult.success) {
            return NextResponse.json(
              { error: subscriptionResult.error || 'Failed to create subscription' },
              { status: 400 }
            )
          }
          responseMessage = 'Membership fee paid and subscription created'
        } else {
          // True one-time pay with card (supported but rare)
          // MOCK CODE, TODO: Integrate payment processor to handle single-pay, non-recurring card flows (provide purchase receipt, role update)
          responseMessage = 'Membership fee paid successfully'
        }
        break
      }

      default:
        // Guard against unsupported type (schema's zod enum should catch, but add fallback)
        return NextResponse.json(
          { error: 'Invalid payment type' },
          { status: 400 }
        )
    }

    // ================
    // Subscription State Fetch & Final Response Build
    // ================

    // Query current user subscription info for up-to-date next_payment_due etc.
    // TODO: Migrate getSubscription to cached layer or use SWR when available natively in Next API.
    const updatedSubscription = await SubscriptionConductor.getSubscription(userId)

    // Compose response for client: details about payment and updated membership state
    // TODO: In Next.js 16+ can use Response.json for streaming payload, if large.
    const response: any = {
      success: true,
      message: responseMessage,
      payment: {
        type: type,
        amount_paid: membershipFee,
        currency: paymentCurrency,
        provider: cardProvider,
        method: 'card',
        timestamp: Date.now(), // TODO: Use serverTime() for consistency/platform audit
      },
      account: {
        subscription_status: updatedSubscription?.status || 'none',
        next_payment_due: updatedSubscription?.next_payment_due,
      },
      benefits_unlocked: type === 'membership_upgrade' ? [
        'Access to confidential opportunities',
        'Priority support',
        'Advanced entity creation',
        'Premium messaging features',
        'Analytics dashboard',
      ] : [],
      next_steps: [
        'Your payment is being processed',
        'You will receive a confirmation email',
        'Your Member access is being activated',
      ],
    }

    // Audit and inform: payment succeeded
    logger.info('Card payment processed successfully', {
      userId,
      type,
      amount: membershipFee,
      provider: cardProvider,
      subscriptionId: subscriptionResult?.subscriptionId,
      subscriptionStatus: updatedSubscription?.status,
    })

    return NextResponse.json(response)
  } catch (error) {
    // LOG all unhandled failures for troubleshooting
    logger.error('Failed to process card payment', { error })

    return NextResponse.json(
      { error: 'Failed to process card payment' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/membership/payment/card
 * Get card payment information and pricing for client UI
 * - Returns available payment methods and pricing details, detects current sub tier.
 *
 * If user is SUBSCRIBER: show Upgrade to Member.
 * If user sub expired: show Renewal.
 * Always show "one-time" (which is just subscription pay).
 *
 * Returns pricing, fees, payment options, and provider metadata.
 */
// TODO: Consider moving options/benefits logic to a global API layer if reused across platforms
export async function GET(request: NextRequest) {
  // Exit static optimization and opt into dynamic behavior (required for auth/sub checks)
  await connection()

  try {
    // User session validation
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = session.user.id
    // Live desk main-currency price for display — matches what POST charges.
    const upgradeTier = await getLiveMemberMainCurrencyTierForPeriod('monthly')
    const membershipFee = upgradeTier.amount
    const feeCurrency = upgradeTier.currency

    // Load latest subscription data for this user
    // TODO: Use loading/cache state where possible (API routes currently re-evaluate on each request)
    const subscription = await SubscriptionConductor.getSubscription(userId)

    // Find which payment processor to offer
    const cardProvider = getCardPaymentProcessor()
    const paymentOptions: any[] = []

    // Offer "Upgrade to Member" if current user is SUBSCRIBER
    if (assertKnownUserRole(session.user.role as UserRolesArray) === UserRolesArray.subscriber) {
      paymentOptions.push({
        type: 'membership_upgrade',
        title: 'Upgrade to Member',
        description: 'One-time upgrade with automatic monthly billing',
        cost: {
          amount: membershipFee.toFixed(2),
          currency: feeCurrency,
        },
        available: true,
        benefits: [
          'Immediate access to Member features',
          'Automatic monthly billing',
          'Cancel anytime',
        ],
      })
    }

    // Offer "Renew Subscription" if membership sub expired or past-due
    if (
      subscription?.status === 'expired' ||
      (subscription?.next_payment_due && subscription.next_payment_due < Date.now())
    ) {
      paymentOptions.push({
        type: 'subscription_renewal',
        title: 'Renew Subscription',
        description: 'Renew your membership for another month',
        cost: {
          amount: membershipFee.toFixed(2),
          currency: feeCurrency,
        },
        available: true,
        benefits: [
          'Restore Member access',
          'Reset payment schedule',
          'Continue with current benefits',
        ],
      })
    }

    // Always offer "membership_fee" (which on cards, is recurring as well)
    paymentOptions.push({
      type: 'membership_fee',
      title: 'One-time Payment',
      description: 'Pay membership fee with automatic subscription',
      cost: {
        amount: membershipFee.toFixed(2),
        currency: feeCurrency,
      },
      available: true,
      benefits: [
        'Automatic monthly billing',
        'Cancel anytime',
        'Full control over payments',
      ],
    })

    // Compose meta/info for client display
    const response = {
      user: {
        current_tier: session.user.role,
        subscription_status: subscription?.status || 'none',
      },
      provider: {
        card_processor: cardProvider || 'none',
        supported_methods: ['credit_card', 'debit_card'],
        supported_brands: ['visa', 'mastercard', 'amex'],
      },
      pricing: {
        membership_fee: {
          amount: membershipFee.toFixed(2),
          currency: feeCurrency,
        },
        discounts: [], // TODO: Supply bulk/discount tiers when rolling out annual/long-term
        fees: {
          processing_fee: cardProvider === 'stripe' ? '2.9% + $0.30' : '2.7%',
          platform_fee: '0',
        },
      },
      payment_options: paymentOptions,
      next_steps: [
        'Select payment type',
        'Enter card details',
        'Complete payment',
        'Access Member features',
      ],
    }

    return NextResponse.json(response)
  } catch (error) {
    // BIG error: inform operator
    logger.error('Failed to get card payment information', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve payment information' },
      { status: 500 }
    )
  }
}
