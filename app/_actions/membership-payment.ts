'use server'

import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { routing } from '@/i18n/routing'
import { logger } from '@/lib/logger'
import type { Locale } from '@/i18n/shared'

import { getRoleLevel, UPGRADEABLE_ROLES } from '@/features/auth/user-role'

export interface MembershipPaymentFormState {
  success?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  redirectUrl?: string
  paymentUrl?: string
}

/**
 * Initiates a membership upgrade payment process
 */
export async function initiateMembershipPayment(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale
): Promise<MembershipPaymentFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to upgrade your membership'
    }
  }

  const targetRole = formData.get('targetRole') as UserRole
  const returnUrl = formData.get('returnUrl') as string
  
  if (!targetRole) {
    return {
      error: 'Target membership role is required'
    }
  }

  // Validate target role
  if (!Object.values(UserRole).includes(targetRole)) {
    return {
      error: 'Invalid membership role selected'
    }
  }

  // Prevent downgrades and invalid upgrades
  const currentRole = (session.user as any)?.role as UserRole || UserRole.visitor
  const currentRoleLevel = getRoleLevel(currentRole)
  const targetRoleLevel = getRoleLevel(targetRole)

  if (!UPGRADEABLE_ROLES.includes(targetRole)) {
    return {
      error: 'This membership tier cannot be purchased online',
    }
  }

  if (targetRoleLevel <= currentRoleLevel) {
    return {
      error: 'You can only upgrade to a higher membership level'
    }
  }

  // Admin role cannot be purchased
  if (targetRole === UserRole.admin) {
    return {
      error: 'Admin role cannot be purchased'
    }
  }

  try {
    const userId = session.user.id
    const userEmail = session.user.email || ''

    logger.info('Membership payment: Initiating payment', {
      userId,
      currentRole,
      targetRole,
      userEmail
    })

    // Generate callback URLs
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const callbackUrl = `${baseUrl}/api/payments/wayforpay/webhook`
    const successReturnUrl = returnUrl || `${baseUrl}/${locale}/profile/membership/success`
    const failureReturnUrl = `${baseUrl}/${locale}/profile/membership/failure`

    // Import and call the WayForPay service
    const { initiatePayment, getMembershipTierConfig } = await import('@/lib/payments/wayforpay-service')
    
    const paymentRequest = {
      userId,
      userEmail,
      targetRole,
      returnUrl: successReturnUrl,
      callbackUrl
    }

    const tierConfig = getMembershipTierConfig(targetRole)
    if (!tierConfig) {
      return { error: 'This membership tier cannot be purchased online' }
    }

    const paymentResponse = await initiatePayment(paymentRequest)

    if (paymentResponse.success && paymentResponse.paymentUrl) {
      logger.info('Membership payment: Payment initiated successfully', {
        userId,
        targetRole,
        orderId: paymentResponse.orderId,
        amount: tierConfig.amount
      })

      // Store payment attempt in user's profile for tracking
      try {
        const { recordPaymentAttempt } = await import('@/features/auth/services/payment-tracking')
        await recordPaymentAttempt({
          userId,
          orderId: paymentResponse.orderId!,
          targetRole,
          amount: tierConfig.amount,
          currency: tierConfig.currency,
          status: 'initiated',
          paymentUrl: paymentResponse.paymentUrl
        })
      } catch (trackingError) {
        logger.warn('Membership payment: Failed to record payment attempt', trackingError)
        // Don't fail the payment process if tracking fails
      }

      return {
        success: true,
        message: 'Payment initiated successfully. You will be redirected to the payment page.',
        paymentUrl: paymentResponse.paymentUrl,
        redirectUrl: paymentResponse.paymentUrl
      }
    } else {
      logger.error('Membership payment: Payment initiation failed', {
        userId,
        targetRole,
        error: paymentResponse.error
      })

      return {
        error: paymentResponse.error || 'Failed to initiate payment. Please try again.'
      }
    }

  } catch (error) {
    logger.error('Membership payment: Unexpected error:', error)
    return {
      error: 'An unexpected error occurred. Please try again later.'
    }
  }
}

/**
 * Handles payment success callback
 */
export async function handlePaymentSuccess(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale,
): Promise<MembershipPaymentFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to process payment success'
    }
  }

  const orderId = formData.get('orderId') as string
  
  if (!orderId) {
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

    // Import and call the payment status service
    const { getPaymentStatus } = await import('@/lib/payments/wayforpay-service')
    const statusResponse = await getPaymentStatus(orderId)

    if (statusResponse.success && statusResponse.status === 'Approved') {
      // Update payment tracking
      try {
        const { updatePaymentStatus } = await import('@/features/auth/services/payment-tracking')
        await updatePaymentStatus(orderId, 'completed')
      } catch (trackingError) {
        logger.warn('Membership payment: Failed to update payment status', trackingError)
      }

      return {
        success: true,
        message: 'Payment completed successfully! Your membership has been upgraded.',
        redirectUrl: `/${locale}/profile/membership/success?orderId=${orderId}`
      }
    } else {
      logger.warn('Membership payment: Payment not approved', {
        userId,
        orderId,
        status: statusResponse.status
      })

      return {
        error: 'Payment was not approved. Please contact support if you believe this is an error.'
      }
    }

  } catch (error) {
    logger.error('Membership payment: Error processing payment success:', error)
    return {
      error: 'An error occurred while processing your payment. Please contact support.'
    }
  }
}

/**
 * Handles payment failure callback
 */
export async function handlePaymentFailure(
  prevState: MembershipPaymentFormState | null,
  formData: FormData,
  locale: Locale,
): Promise<MembershipPaymentFormState> {

  const session = await auth()
  
  if (!session?.user?.id) {
    return {
      error: 'You must be logged in to process payment failure'
    }
  }

  const orderId = formData.get('orderId') as string
  const reason = formData.get('reason') as string
  
  try {
    const userId = session.user.id

    logger.info('Membership payment: Processing payment failure', {
      userId,
      orderId,
      reason
    })

    // Update payment tracking
    try {
      const { updatePaymentStatus } = await import('@/features/auth/services/payment-tracking')
      await updatePaymentStatus(orderId, 'failed', reason)
    } catch (trackingError) {
      logger.warn('Membership payment: Failed to update payment status', trackingError)
    }

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
