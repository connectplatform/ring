'use server'

import { auth } from '@/auth'
import { UserRolesArray, getRoleLevel, UPGRADEABLE_ROLES, isPlatformAdmin } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/shared'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getCardPaymentProcessor, getSupportedPaymentMethods } from '@/lib/payments/subscription/subscription-config'

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
 * Initiates a membership upgrade payment process.
 * Main entrypoint: Handles user session, role validation, and payment initiation via credit or card.
 *
 * @param prevState - Previous form state (for server actions patterns, not currently used)
 * @param formData - Incoming form data with membership/payment fields
 * @param locale - Current UI locale
 * @returns A promise of the new membership payment form state with either error, redirect, or success keys
 */
// TODO: If using React 19 Server Actions (Next 16), migrate this to a server action signature, 
//   e.g. `export const initiateMembershipPayment = async ...`, and use input types direct from React.
//   - Also use typed form values instead of extracting from generic FormData.
export async function initiateMembershipPayment(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale
): Promise<MembershipPaymentFormState> {
  // TODO: Use Zod for validation and structure error and fieldErrors for better client feedback

  // 1. Ensure the user is authenticated and session exists
  const session = await auth()

  if (!session?.user?.id) {
    // User not logged in; block payment initiation
    return {
      error: 'You must be logged in to upgrade your membership'
    }
  }

  // 2. Gather input values from form
  const targetRole = formData.get('targetRole') as UserRolesArray[number]
  const returnUrl = formData.get('returnUrl') as string

  if (!targetRole) {
    // Form missing required value: membership tier
    return {
      error: 'Target membership role is required'
    }
  }

  // 3. Check role is valid and included in our list
  if (!Object.values(UserRolesArray).includes(targetRole as UserRolesArray)) {
    return {
      error: 'Invalid membership role selected'
    }
  }

  // 4. Determine user's current role; default to visitor if not set
  const currentRole = (session.user as any)?.role as UserRolesArray[number] || UserRolesArray.visitor
  const currentRoleLevel = getRoleLevel(currentRole)
  const targetRoleLevel = getRoleLevel(targetRole)

  // Only allow upgrades to roles explicitly allowed for self-service upgrade
  if (!UPGRADEABLE_ROLES.includes(targetRole as UserRolesArray)) {
    return {
      error: 'This membership tier cannot be purchased online',
    }
  }

  // Disallow downgrades, same-level, or lateral role moves
  if (targetRoleLevel <= currentRoleLevel) {
    return {
      error: 'You can only upgrade to a higher membership level'
    }
  }

  // Restrict admin or platform staff roles to backoffice only
  if (isPlatformAdmin(targetRole as UserRolesArray)) {
    return {
      error: 'Platform admin roles cannot be purchased',
    }
  }

  try {
    // 5. Prepare user/session data for payment logic
    const userId = session.user.id
    const userEmail = session.user.email || ''

    logger.info('Membership payment: Initiating payment', {
      userId,
      currentRole,
      targetRole,
      userEmail
    })

    // 6. Determine payment method; fallback to credit_balance by default
    const paymentMethod = formData.get('paymentMethod') as string || 'credit_balance'

    // 7. Build return/redirect URLs for after payment
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const successReturnUrl = returnUrl || `${baseUrl}/${locale}/profile/membership/success`
    // NOTE: failureReturnUrl is reserved for future extensibility
    const failureReturnUrl = `${baseUrl}/${locale}/profile/membership/failure`

    // 8. Fetch pricing config from the Single Source of Truth
    // TODO: If pricing will change by input (custom plans, coupons, region), pass args to this ssot helper
    const { getMemberFiatTier } = await import('@/lib/membership/pricing')
    const tierConfig = getMemberFiatTier()
    if (!tierConfig) {
      // STUB: Could fetch customized configs here in future—add handling for productId, etc.
      return { error: 'This membership tier cannot be purchased online' }
    }

    // 9. Process payment by detected method
    if (paymentMethod === 'credit_balance') {
      // ---- Credit Balance (Native Token) Payment Path ----
      // Implementation: Deduct user's balance, record payment, and return redirect or error
      const success = await initiateCreditBalancePayment(userId, tierConfig, successReturnUrl)
      if (success) {
        // Payment initiation succeeded
        return {
          success: true,
          message: 'Payment initiated successfully. You will be upgraded to Member.',
          redirectUrl: successReturnUrl
        }
      }
      // If balance insufficient or payment failed
      return { error: 'Failed to process credit balance payment' }
    }

    // ---- Card-Based Processor Payment Path (PaymentConductor SSOT) ----
    if (paymentMethod === 'card' || paymentMethod === 'stripe' || paymentMethod === 'wayforpay') {
      const cardProcessor = getCardPaymentProcessor()
      const supportedMethods = getSupportedPaymentMethods()

      if (!supportedMethods.includes(cardProcessor)) {
        return {
          error: `${cardProcessor} is not currently supported. Please use credit balance.`
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
        metadata: { source: 'membership_action', targetRole },
      })

      if (!result.success) {
        logger.error('Membership payment: PaymentConductor failed', {
          userId,
          targetRole,
          error: result.error,
        })
        return {
          error: result.error || 'Failed to initiate payment. Please try again.'
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

    // Handle unhandled/unknown payment methods gracefully
    return {
      error: `Unknown payment method: ${paymentMethod}`
    }

  } catch (error) {
    // Catch-all for unexpected errors; redact sensitive detail for prod logs
    logger.error('Membership payment: Unexpected error:', error)
    return {
      error: 'An unexpected error occurred. Please try again later.'
    }
  }
}

/**
 * Internal helper: process credit-balance payment for membership upgrade.
 * Deducts funds, confirms price, triggers subscription creation.
 */
async function initiateCreditBalancePayment(
  userId: string,
  tierConfig: any,
  returnUrl: string
): Promise<boolean> {
  try {
    // Dynamically import credit-balance and pricing services (to reduce cold start cost)
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')
    const { NativeTokenPriceOracleService } = await import('@/features/wallet/services/native-token-price-oracle')
    // Fetch the current USD price for accurate deduction (for crypto tokens)
    const priceOracleService = NativeTokenPriceOracleService.getInstance()
    const priceData = await priceOracleService.getNativeTokenUsdPrice()

    // Deduct membership fee using user's available balance 
    const result = await creditBalanceService.processMembershipFee(
      userId,
      tierConfig.amount.toString(),
      priceData.price
    )

    if (!result.success) {
      // Insufficient funds or deduction failed
      logger.warn('Membership payment: Insufficient credit balance', { userId })
      return false
    }

    // STUB: If discounts or tierConfig parameterization is implemented, extend this logic to account for them
    // TODO: If tierConfig can contain discounts, refactor here (step: fetch user-specific price, run calculation, update deduction).

    // Ensure we have up-to-date email (optionally optimize by using upstream value)
    const session = await auth()
    const userEmail = session?.user?.email || ''

    // Call conductor to register subscription/upgrade after balance withdrawal
    await SubscriptionConductor.createSubscription({
      userId,
      userEmail,
      provider: 'credit_balance',
      gateway: 'Credit Balance',
      method: 'credit_balance',
      amount: tierConfig.amount,
      currency: tierConfig.currency,
      gatewayFeePercent: 0,
      gatewayFeeFixed: 0,
      returnUrl,
      metadata: { source: 'credit_balance_action' },
    })

    // Return true if everything went through
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
