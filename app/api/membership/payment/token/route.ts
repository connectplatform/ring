import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { logger } from '@/lib/logger'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import { getMembershipRingUpgradeAmount, getMembershipRingRenewalAmount } from '@/lib/membership/pricing'
import { getNativeTokenBalanceForUser, transferNativeTokenForUser } from '@/features/wallet/chains/native-token-transfer-service'
import { getEvmTokenBalance } from '@/features/wallet/chains/evm/evm-token-transfer'
import { getNativeChain, getNativeTokenSymbol, getNativeTokenTreasuryAddress } from '@/lib/ring-config-chain'
// TODO: Consolidate native chain and token config utils for future proofing

/**
 * Native token payment request schema. 
 * - Validates POST data input structure.
 * - For on-chain native token payments (solana sponsored spl).
 *
 * For fiat use /api/membership/payment/credit, or /api/membership/payment/card for cards.
 */
const TokenPaymentRequestSchema = z.object({
  type: z.enum(['membership_upgrade', 'subscription_renewal', 'membership_fee']), // Payment intent
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a valid positive number').optional(),
  auto_subscribe: z.boolean().default(false), // Whether to activate automatic renewal
  toAddress: z.string().optional(), // Override for treasury address
})

// Type for validated requests
type TokenPaymentRequest = z.infer<typeof TokenPaymentRequestSchema>

/**
 * POST /api/membership/payment/token
 *
 * Handles payment flow using native blockchain token.
 * - Supported intents: upgrade, renewal, one-time.
 * - Handles transfer, subscription ledger, and returns result.
 * - All gas is sponsored by treasury (user pays no gas).
 */
export async function POST(request: NextRequest) {
  // Next.js 16: prevents static prerendering on this route
  await connection()

  try {
    // Try to get logged-in user session (server-side)
    const session = await auth()
    if (!session?.user?.id) {
      // Not authenticated
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email || '' // Fallback to empty string if missing

    // Try to parse request body as JSON
    const requestBody = await request.json()

    // Validate against schema
    let validatedRequest: TokenPaymentRequest
    try {
      validatedRequest = TokenPaymentRequestSchema.parse(requestBody)
    } catch (validationError) {
      // Invalid payload, log and return error
      logger.warn('Invalid token payment request', {
        userId,
        requestBody,
        validationError
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 }
      )
    }

    // Destructure input
    const { type, amount, auto_subscribe, toAddress } = validatedRequest

    // Determine correct fee (use provided amount, fallback to system default)
    const defaultUpgradeAmount = getMembershipRingUpgradeAmount()
    const defaultRenewalAmount = getMembershipRingRenewalAmount()
    // If explicit amount present, use it; else, use contextual default
    const membershipFee =
      amount ??
      (type === 'subscription_renewal'
        ? defaultRenewalAmount.toString()
        : defaultUpgradeAmount.toString())
    const paymentAmount = parseFloat(membershipFee)

    // Validate that payment amount is in acceptable range (defensive check)
    if (paymentAmount <= 0 || paymentAmount > 100) {
      return NextResponse.json(
        {
          error: `Invalid payment amount. Must be between 0.01 and 100 ${getNativeTokenSymbol()}`,
        },
        { status: 400 }
      )
    }

    // Query user's token balance (on-chain)
    // TODO: Move to server/edge caching if possible for perf
    const onChainBalance = await getNativeTokenBalanceForUser(userId)
    if (parseFloat(onChainBalance.balance) < paymentAmount) {
      // User does not have sufficient token balance
      return NextResponse.json(
        {
          error: `Insufficient ${onChainBalance.tokenSymbol} balance for ${type} payment`,
          current_balance: onChainBalance.balance,
          required_amount: membershipFee,
          symbol: onChainBalance.tokenSymbol,
          chain: onChainBalance.chain,
        },
        { status: 400 }
      )
    }

    // Set the treasury/receiving address, prefer input override over env
    // TODO: Migrate to a centralized config utility for treasury
    const treasuryAddress = toAddress || process.env.NATIVE_TOKEN_TREASURY_ADDRESS
    if (!treasuryAddress) {
      // Treasury not configured: cannot process
      return NextResponse.json(
        {
          error: 'Treasury address not configured',
          message: 'NATIVE_TOKEN_TREASURY_ADDRESS environment variable is required',
        },
        { status: 503 }
      )
    }

    // Do the on-chain transfer (use treasury as destination, sponsor gas)
    let transferResult
    try {
      transferResult = await transferNativeTokenForUser({
        userId,
        toAddress: treasuryAddress,
        amount: membershipFee,
      })
      // TODO: Validate shape of transferResult for txHash/addresses in prod
    } catch (transferError) {
      // Transfer failed at chain/gateway level
      logger.error('On-chain native token transfer failed', {
        userId,
        error: transferError,
      })
      // Return user-friendly error
      return NextResponse.json(
        {
          error: 'On-chain transfer failed',
          message: transferError instanceof Error ? transferError.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    //--- Handle membership/ledger state ---
    let subscriptionResult
    let responseMessage
    switch (type) {
      case 'membership_upgrade': {
        // Only "subscriber" can upgrade to full member
        if (assertKnownUserRole(session.user.role as UserRolesArray) !== UserRolesArray.subscriber) {
          return NextResponse.json(
            {
              error: 'Invalid upgrade request',
              message: 'Only Subscribers can upgrade to Member using native token',
              current_role: session.user.role,
            },
            { status: 400 }
          )
        }

        if (auto_subscribe) {
          // Create a recurring subscription ledger entry via conductor service
          // TODO: If native Next16/React19 has job(queuing)/mutation API available, refactor for atomicity
          subscriptionResult = await SubscriptionConductor.createSubscription({
            userId,
            userEmail,
            provider: 'native_token',
            gateway: getNativeTokenSymbol(),
            method: 'crypto',
            amount: paymentAmount,
            currency: getNativeTokenSymbol(),
            gatewayFeePercent: 0,
            gatewayFeeFixed: 0,
            metadata: {
              source: 'token_payment',
              auto_renew: true,
              tx_hash: transferResult.txHash,
            },
          })

          if (!subscriptionResult.success) {
            // Creation failed, but upgrade went through so don't atomic rollback
            logger.warn('SubscriptionConductor.createSubscription failed after upgrade', {
              userId,
              error: subscriptionResult.error,
            })
            // TODO: Initiate compensation logic/job for dangling upgrade without subscription if pattern repeats
          }
          responseMessage = 'Upgraded to Member and created automatic subscription'
        } else {
          // Simple manual upgrade, no further action
          responseMessage = 'Upgraded to Member tier successfully'
        }
        break
      }

      case 'subscription_renewal': {
        // Renew an expired or due subscription
        // TODO: Integrate any upcoming React19/Next auth/session improvements for server actions
        subscriptionResult = await SubscriptionConductor.renewSubscription(
          userId,
          'native_token', // Native token as provider string
        )

        if (!subscriptionResult.success) {
          // Return reason for failed renewal (e.g. no previous sub, etc)
          return NextResponse.json(
            { error: subscriptionResult.error || 'Renewal failed' },
            { status: 400 }
          )
        }

        responseMessage = 'Subscription renewed successfully'
        break
      }

      case 'membership_fee': {
        // One-time payment (no recurring, no change to subscription ledger)
        // Use-case: pay-per-use
        responseMessage = 'Membership fee paid successfully'
        break
      }

      default:
        // Defensive: unexpected payment type
        return NextResponse.json(
          { error: 'Invalid payment type' },
          { status: 400 }
        )
    }

    //--- Prepare response ---
    // Get latest sub status
    // TODO: Server caching if invoked in hot loop
    const updatedSubscription = await SubscriptionConductor.getSubscription(userId)

    const response: any = {
      success: true,
      message: responseMessage, // summary text
      payment: {
        type: type,
        amount_paid: membershipFee,
        currency: '{native_token}',
        chain: onChainBalance.chain,
        tx_hash: transferResult.txHash,
        from_address: transferResult.fromAddress,
        to_address: treasuryAddress,
        timestamp: Date.now(),
      },
      account: {
        new_balance: (parseFloat(onChainBalance.balance) - paymentAmount).toString(),
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
    }

    // Log for auditing/ops
    logger.info('Token payment processed successfully', {
      userId,
      type,
      amount: membershipFee,
      txHash: transferResult.txHash,
      newBalance: response.account.new_balance,
      subscriptionId: subscriptionResult?.subscriptionId,
      subscriptionStatus: updatedSubscription?.status,
    })

    // Return public info
    return NextResponse.json(response)

  } catch (error) {
    // Global error catcher for endpoint
    logger.error('Failed to process token payment', { error })

    return NextResponse.json(
      { error: 'Failed to process token payment' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/membership/payment/token
 *
 * Returns user's native token (RING) balance and available payment flows.
 * - Shows available actions (upgrade, renewal, one-time) and requirement info.
 */
export async function GET(request: NextRequest) {
  // Ensure this endpoint is never statically rendered (important for live balances)
  await connection()

  try {
    // Authenticate user (server-only)
    const session = await auth()
    if (!session?.user?.id) {
      // Must be logged in
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Fetch on-chain balance object (currency, address, chain, balance)
    // TODO: Use React19/Next16 server-only caching pattern for idempotent reads
    const onChainBalance = await getNativeTokenBalanceForUser(userId)
    const currentBalance = parseFloat(onChainBalance.balance)

    // Determine canonical fee for membership upgrade (always presented)
    const membershipFee = getMembershipRingUpgradeAmount()

    // Fetch current subscription status
    // TODO: Memoize this if called multiple times in same request context
    const subscription = await SubscriptionConductor.getSubscription(userId)

    // Compose all payment options user could take
    const paymentOptions: any[] = []

    // Option 1: Subscriber → Member upgrade
    if (assertKnownUserRole(session.user.role as UserRolesArray) === UserRolesArray.subscriber) {
      paymentOptions.push({
        type: 'membership_upgrade',
        title: 'Upgrade to Member',
        description: 'One-time upgrade with optional auto-renewal',
        cost: {
          ring_amount: membershipFee.toFixed(2),
          currency: '{native_token}',
        },
        available: currentBalance >= membershipFee,
        benefits: [
          'Immediate access to Member features',
          'Optional automatic monthly renewals',
          'Cancel anytime',
        ],
      })
    }

    // Option 2: Subscription renewal (if status is expired or due)
    if (subscription?.status === 'expired' || (subscription?.next_payment_due && subscription.next_payment_due < Date.now())) {
      paymentOptions.push({
        type: 'subscription_renewal',
        title: 'Renew Subscription',
        description: 'Renew your membership for another month',
        cost: {
          ring_amount: membershipFee.toFixed(2),
          currency: '{native_token}',
        },
        available: currentBalance >= membershipFee,
        benefits: [
          'Restore Member access',
          'Reset payment schedule',
          'Continue with current benefits',
        ],
      })
    }

    // Option 3: One-time membership (no sub, pay-on-demand)
    // TODO: Make 1.0 dynamic if tiered/currency is planned
    paymentOptions.push({
      type: 'membership_fee',
      title: 'One-time Payment',
      description: 'Pay membership fee without subscription',
      cost: {
        ring_amount: '1.0',
        currency: '{native_token}',
      },
      available: currentBalance >= membershipFee,
      benefits: [
        'No automatic renewals',
        'Pay as needed',
        'Full control over payments',
      ],
    })

    // Compose return object for frontend
    const response = {
      user: {
        current_balance: currentBalance.toString(),
        balance_sufficient: currentBalance >= membershipFee,
        current_tier: session.user.role,
        subscription_status: subscription?.status || 'none',
      },
      on_chain: {
        balance: onChainBalance.balance,
        address: onChainBalance.address,
        chain: onChainBalance.chain,
        symbol: onChainBalance.tokenSymbol,
      },
      pricing: {
        membership_fee: {
          ring_amount: membershipFee.toFixed(2),
          currency: '{native_token}',
        },
        discounts: [], // MOCK CODE, TODO: Add discount implementation when such flows go live
        fees: {
          processing_fee: '0',
          network_fee: '0', // Gas is sponsored by treasury (always 0)
          platform_fee: '0',
        },
      },
      payment_options: paymentOptions,
      requirements: {
        minimum_balance: membershipFee.toFixed(2),
        balance_shortfall: Math.max(0, membershipFee - currentBalance).toString(),
        top_up_needed: currentBalance < membershipFee,
      },
      next_steps: currentBalance >= membershipFee ? [
        'Select payment type',
        'Confirm payment details',
        'Complete on-chain transfer',
        'Access Member features',
      ] : [
        'Top up native token balance',
        'Return to complete payment',
      ],
    }

    return NextResponse.json(response)

  } catch (error) {
    // Defensive catch for unexpected errors
    logger.error('Failed to get token payment information', { error })

    return NextResponse.json(
      { error: 'Failed to retrieve payment information' },
      { status: 500 }
    )
  }
}
