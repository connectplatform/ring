'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/i18n-config'
import { logger } from '@/lib/logger'

// Role hierarchy for validation
const ROLE_HIERARCHY = {
  [UserRole.VISITOR]: 0,
  [UserRole.SUBSCRIBER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CONFIDENTIAL]: 3,
  [UserRole.ADMIN]: 4,
} as const

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
  formData: FormData
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
  const currentRole = (session.user as any)?.role as UserRole || UserRole.VISITOR
  const currentRoleLevel = ROLE_HIERARCHY[currentRole]
  const targetRoleLevel = ROLE_HIERARCHY[targetRole]

  if (targetRoleLevel <= currentRoleLevel) {
    return {
      error: 'You can only upgrade to a higher membership level'
    }
  }

  // Admin role cannot be purchased
  if (targetRole === UserRole.ADMIN) {
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
    const successReturnUrl = returnUrl || `${baseUrl}/${defaultLocale}/profile/membership/success`
    const failureReturnUrl = `${baseUrl}/${defaultLocale}/profile/membership/failure`

    // Import and call the WayForPay service
    const { initiatePayment, MEMBERSHIP_PRICES } = await import('@/lib/payments/wayforpay-service')
    
    const paymentRequest = {
      userId,
      userEmail,
      targetRole,
      returnUrl: successReturnUrl,
      callbackUrl
    }

    const paymentResponse = await initiatePayment(paymentRequest)

    if (paymentResponse.success && paymentResponse.paymentUrl) {
      logger.info('Membership payment: Payment initiated successfully', {
        userId,
        targetRole,
        orderId: paymentResponse.orderId,
        amount: MEMBERSHIP_PRICES[targetRole].amount
      })

      // Store payment attempt in user's profile for tracking
      try {
        const { recordPaymentAttempt } = await import('@/features/auth/services/payment-tracking')
        await recordPaymentAttempt({
          userId,
          orderId: paymentResponse.orderId!,
          targetRole,
          amount: MEMBERSHIP_PRICES[targetRole].amount,
          currency: MEMBERSHIP_PRICES[targetRole].currency,
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
  formData: FormData
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
        redirectUrl: `/${defaultLocale}/profile/membership/success?orderId=${orderId}`
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
  formData: FormData
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
      redirectUrl: `/${defaultLocale}/profile/membership/failure?orderId=${orderId}&reason=${encodeURIComponent(reason || 'Unknown error')}`
    }

  } catch (error) {
    logger.error('Membership payment: Error processing payment failure:', error)
    return {
      error: 'An error occurred while processing the payment failure. Please contact support.'
    }
  }
}
