'use server'

import { auth } from '@/auth'
import { UserRolesArray, getRoleLevel, UPGRADEABLE_ROLES, isPlatformAdmin } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/shared'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getCardPaymentProcessor, getSupportedPaymentMethods } from '@/lib/payments/subscription/subscription-config'
import {
  initiateMembershipPaymentSchema,
  parseMembershipForm,
} from '@/lib/zod/membership-schemas'

export interface MembershipPaymentFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  redirectUrl?: string
  redirect?: {
    mode: 'navigate' | 'form_post'
    url: string
    fields?: Record<string, string | string[]>
  }
  paymentUrl?: string
  paymentFields?: Record<string, string | string[]>
}

/**
 * Initiates membership upgrade — useActionState compatible.
 * Validates FormData with shared Zod (`initiateMembershipPaymentSchema`).
 */
export async function initiateMembershipPayment(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale
): Promise<MembershipPaymentFormState> {
  void prevState

  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'You must be logged in to upgrade your membership' }
  }

  const parsed = parseMembershipForm(initiateMembershipPaymentSchema, formData)
  if (parsed.success === false) {
    return { error: parsed.error }
  }

  const targetRole = parsed.data.targetRole as UserRolesArray[number]
  const returnUrl = parsed.data.returnUrl
  const paymentMethod = parsed.data.paymentMethod || 'credit_balance'
  const billingPeriod = parsed.data.billingPeriod || 'monthly'

  if (!Object.values(UserRolesArray).includes(targetRole as UserRolesArray)) {
    return { error: 'Invalid membership role selected' }
  }

  const currentRole =
    ((session.user as { role?: UserRolesArray[number] })?.role as UserRolesArray[number]) ||
    UserRolesArray.visitor
  const currentRoleLevel = getRoleLevel(currentRole)
  const targetRoleLevel = getRoleLevel(targetRole)

  if (!UPGRADEABLE_ROLES.includes(targetRole as UserRolesArray)) {
    return { error: 'This membership tier cannot be purchased online' }
  }
  if (targetRoleLevel <= currentRoleLevel) {
    return { error: 'You can only upgrade to a higher membership level' }
  }
  if (isPlatformAdmin(targetRole as UserRolesArray)) {
    return { error: 'Platform admin roles cannot be purchased' }
  }

  try {
    const userId = session.user.id
    const userEmail = session.user.email || ''

    logger.info('Membership payment: Initiating payment', {
      userId,
      currentRole,
      targetRole,
      paymentMethod,
      billingPeriod,
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const successReturnUrl = returnUrl || `${baseUrl}/${locale}/profile/membership/success`

    const { getMembershipCreditAmountForPeriod, getMembershipRingAmountForPeriod } = await import(
      '@/lib/membership/pricing'
    )
    const { getLiveMemberMainCurrencyTierForPeriod } = await import(
      '@/lib/membership/pricing-live'
    )
    const { getCreditUnitLabel } = await import('@/lib/ring-oracle')
    // Live desk price so the charge equals what the desk quotes right now.
    const tierConfig = await getLiveMemberMainCurrencyTierForPeriod(billingPeriod)
    if (!tierConfig) {
      return { error: 'This membership tier cannot be purchased online' }
    }
    const creditAmount = getMembershipCreditAmountForPeriod(billingPeriod)
    const ringAmount = getMembershipRingAmountForPeriod(billingPeriod)

    if (paymentMethod === 'credit_balance') {
      const success = await initiateCreditBalancePayment(
        userId,
        {
          amount: creditAmount,
          currency: getCreditUnitLabel(),
          ringAmount,
          mainCurrencyAmount: tierConfig.amount,
          mainCurrency: tierConfig.currency,
        },
        successReturnUrl,
      )
      if (success) {
        return {
          success: true,
          message: 'Payment initiated successfully. You will be upgraded to Member.',
          redirectUrl: successReturnUrl,
        }
      }
      return { error: 'Failed to process credit balance payment' }
    }

    if (
      paymentMethod === 'card' ||
      paymentMethod === 'stripe' ||
      paymentMethod === 'wayforpay'
    ) {
      const cardProcessor = getCardPaymentProcessor()
      const supportedMethods = getSupportedPaymentMethods()

      if (!supportedMethods.includes(cardProcessor)) {
        return {
          error: `${cardProcessor} is not currently supported. Please use credit balance.`,
        }
      }

      const sub = await SubscriptionConductor.createSubscription({
        userId,
        userEmail,
        provider: cardProcessor as 'wayforpay' | 'stripe',
        gateway: cardProcessor,
        method: 'card',
        amount: tierConfig.amount,
        currency: tierConfig.currency,
        gatewayFeePercent: 0,
        gatewayFeeFixed: 0,
        returnUrl: successReturnUrl,
        metadata: {
          source: 'membership_action',
          targetRole,
          billingPeriod,
          type: 'membership_upgrade',
        },
      })

      if (sub.success && (sub.redirectUrl || sub.paymentFields || sub.redirect)) {
        return {
          success: true,
          message: 'Payment initiated successfully. You will be redirected to the payment page.',
          redirect: sub.redirect,
          paymentUrl: sub.redirectUrl ?? sub.redirect?.url,
          paymentFields: sub.paymentFields ?? sub.redirect?.fields,
          redirectUrl: sub.redirectUrl ?? sub.redirect?.url,
        }
      }

      const { PaymentConductor } = await import('@/lib/payments/conductor/payment-conductor')
      const result = await PaymentConductor.createCheckout({
        purpose: 'membership_upgrade',
        userId,
        userEmail,
        entityId: userId,
        amount: tierConfig.amount,
        currency: tierConfig.currency,
        returnUrl: successReturnUrl,
        locale,
        targetRole,
        metadata: {
          source: 'membership_action',
          targetRole,
          billingPeriod,
        },
      })

      if (!result.success) {
        logger.error('Membership payment: PaymentConductor failed', {
          userId,
          targetRole,
          error: result.error || sub.error,
        })
        return {
          error: result.error || sub.error || 'Failed to initiate payment. Please try again.',
        }
      }

      if (result.redirect || result.paymentUrl || result.paymentFields) {
        return {
          success: true,
          message: 'Payment initiated successfully. You will be redirected to the payment page.',
          redirect: result.redirect,
          paymentUrl: result.paymentUrl,
          paymentFields: result.paymentFields,
          redirectUrl: result.paymentUrl ?? result.redirect?.url,
        }
      }

      return {
        success: true,
        message: 'Payment processed successfully! Your membership has been upgraded.',
        redirectUrl: successReturnUrl,
      }
    }

    if (paymentMethod === 'paypal') {
      const sub = await SubscriptionConductor.createSubscription({
        userId,
        userEmail,
        provider: 'paypal',
        gateway: 'PayPal',
        method: 'paypal',
        amount: tierConfig.amount,
        currency: tierConfig.currency,
        gatewayFeePercent: 0,
        gatewayFeeFixed: 0,
        returnUrl: successReturnUrl,
        metadata: {
          source: 'membership_action',
          targetRole,
          billingPeriod,
          type: 'membership_upgrade',
        },
      })

      if (sub.success && (sub.redirectUrl || sub.redirect)) {
        return {
          success: true,
          message: 'Redirecting to PayPal…',
          redirect: sub.redirect,
          paymentUrl: sub.redirectUrl ?? sub.redirect?.url,
          redirectUrl: sub.redirectUrl ?? sub.redirect?.url,
        }
      }

      const { PaymentConductor } = await import('@/lib/payments/conductor/payment-conductor')
      const result = await PaymentConductor.createCheckout({
        purpose: 'membership_upgrade',
        rail: 'card',
        userId,
        userEmail,
        entityId: userId,
        amount: tierConfig.amount,
        currency: tierConfig.currency,
        returnUrl: successReturnUrl,
        locale,
        targetRole,
        metadata: {
          source: 'membership_action',
          targetRole,
          billingPeriod,
          processor: 'paypal',
        },
      })

      if (!result.success) {
        return {
          error: result.error || sub.error || 'Failed to initiate PayPal payment',
        }
      }

      return {
        success: true,
        message: 'Redirecting to PayPal…',
        redirect: result.redirect,
        paymentUrl: result.paymentUrl,
        paymentFields: result.paymentFields,
        redirectUrl: result.paymentUrl ?? result.redirect?.url,
      }
    }

    return { error: `Unknown payment method: ${paymentMethod}` }
  } catch (error) {
    logger.error('Membership payment: Unexpected error:', error)
    return { error: 'An unexpected error occurred. Please try again later.' }
  }
}

/**
 * Internal helper: process credit-balance payment for membership upgrade.
 * Deducts credit **points** (desk SSOT: 100 points = 1 RING), then registers subscription.
 */
async function initiateCreditBalancePayment(
  userId: string,
  pricing: {
    amount: number
    currency: string
    ringAmount: number
    mainCurrencyAmount: number
    mainCurrency: string
  },
  returnUrl: string
): Promise<boolean> {
  try {
    // Single charge via credit provider inside Conductor — do not pre-deduct.
    const session = await auth()
    const userEmail = session?.user?.email || ''

    const sub = await SubscriptionConductor.createSubscription({
      userId,
      userEmail,
      provider: 'credit_balance',
      gateway: 'Credit Balance',
      method: 'credit_balance',
      amount: pricing.amount,
      currency: pricing.currency,
      gatewayFeePercent: 0,
      gatewayFeeFixed: 0,
      returnUrl,
      metadata: {
        source: 'credit_balance_action',
        ringAmount: pricing.ringAmount,
        mainCurrencyAmount: pricing.mainCurrencyAmount,
        mainCurrency: pricing.mainCurrency,
      },
    })

    if (!sub.success) {
      logger.warn('Membership payment: credit Conductor failed', {
        userId,
        error: sub.error,
      })
      return false
    }

    return true
  } catch (error) {
    logger.error('Credit balance payment failed', { userId, error })
    return false
  }
}

/**
 * Handles payment success callback after redirect (by provider)
 * Confirms final upgrade status via conductor record.
 *
 * @param prevState - Previous form state (for compatibility, not used here)
 * @param formData - Form data from provider redirect (must contain orderId)
 * @param locale - Current UI locale
 * @returns MembershipPaymentFormState indicating outcome to the UI
 */
// TODO: Refactor as a server/route action in Next.js 16—extract all inputs with typed objects if possible
export async function handlePaymentSuccess(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale,
): Promise<MembershipPaymentFormState> {
  // Verify user is authenticated before changing membership/payment state
  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to process payment success'
    }
  }

  // Extract required reference from provider callback payload
  const orderId = formData.get('orderId') as string

  if (!orderId) {
    // Malformed or missing redirect parameters
    return {
      error: 'Order ID is required'
    }
  }

  try {
    const userId = session.user.id

    logger.info('Membership payment: Processing payment success', {
      userId,
      orderId
    })

    // Fetch the relevant subscription record and check its status post-payment
    const subscription = await SubscriptionConductor.getSubscription(userId)

    // Check for final subscription/upgrade status
    if (subscription && subscription.status === 'active') {
      return {
        success: true,
        message: 'Payment completed successfully! Your membership has been upgraded.',
        redirectUrl: `/${locale}/profile/membership/success?orderId=${orderId}`
      }
    }

    // Edge case: Payment wasn't finalized with provider
    return {
      error: 'Payment was not approved. Please contact support if you believe this is an error.'
    }

  } catch (error) {
    logger.error('Membership payment: Error processing payment success:', error)
    return {
      error: 'An error occurred while processing your payment. Please contact support.'
    }
  }
}

/**
 * Handles payment failure callback after redirect (by provider).
 * Always shows actionable UI message and routes to fail screen with original details.
 *
 * @param prevState - Previous form state (per Next.js server action compatibility)
 * @param formData - Redirected form data from provider (expects orderId and reason)
 * @param locale - Current UI locale
 * @returns MembershipPaymentFormState describing the payment failure outcome
 */
// TODO: Refactor as a native Next.js 16/React 19 server action, strongly typing input for easier DX
export async function handlePaymentFailure(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale,
): Promise<MembershipPaymentFormState> {
  // Ensure valid logged-in session for processing errors against current user
  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to process payment failure'
    }
  }

  // Extracts payment order and reason for the fail-state redirect
  const orderId = formData.get('orderId') as string
  const reason = formData.get('reason') as string

  try {
    const userId = session.user.id

    logger.info('Membership payment: Processing payment failure', {
      userId,
      orderId,
      reason
    })

    // Always present fail-state with error text and all details in redirect
    return {
      success: false,
      message: 'Payment was not completed. You can try again or contact support for assistance.',
      redirectUrl: `/${locale}/profile/membership/failure?orderId=${orderId}&reason=${encodeURIComponent(reason || 'Unknown error')}`
    }

  } catch (error) {
    logger.error('Membership payment: Error processing payment failure:', error)
    return {
      error: 'An error occurred while processing the payment failure. Please contact support.'
    }
  }
}
