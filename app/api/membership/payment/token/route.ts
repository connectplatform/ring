import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { logger } from '@/lib/logger'
import { assertKnownUserRole, UserRolesArray } from '@/features/auth/user-role'
import {
  getMembershipRingUpgradeAmount,
  getMembershipRingRenewalAmount,
} from '@/lib/membership/pricing'
import {
  getNativeTokenBalanceForUser,
  transferNativeTokenForUser,
} from '@/features/wallet/chains/native-token-transfer-service'
import { getNativeTokenSymbol, getNativeTokenTreasuryAddress } from '@/lib/ring-config-chain'
import { isMembershipDeployed } from '@/lib/payments/subscription/ring-membership-config'
import { membershipApiPaymentBodySchema } from '@/lib/zod/membership-schemas'

/**
 * Native token payment — extends shared membership API body (auto_subscribe defaults false).
 */
const TokenPaymentRequestSchema = membershipApiPaymentBodySchema.extend({
  auto_subscribe: z.boolean().default(false),
})

type TokenPaymentRequest = z.infer<typeof TokenPaymentRequestSchema>

function resolveTreasuryOrError(
  toAddress?: string,
): { ok: true; address: string } | { ok: false; response: NextResponse } {
  const treasuryAddress = toAddress || getNativeTokenTreasuryAddress()
  if (!treasuryAddress || treasuryAddress === 'RING' || treasuryAddress.length < 32) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Treasury address not configured',
          message:
            'Set tokens.nativeToken.tokenTreasuryAddress in ring-config.json or NATIVE_TOKEN_TREASURY_ADDRESS',
        },
        { status: 503 },
      ),
    }
  }
  return { ok: true, address: treasuryAddress }
}

/**
 * POST /api/membership/payment/token
 *
 * Native-token membership via SubscriptionConductor:
 * - Membership program deployed → on-chain create/renew
 * - Soft launch (empty membershipProgramId) → sponsored SPL to treasury + ledger + role
 * One-shot `membership_fee` → treasury SPL only (no subscription ledger)
 */
export async function POST(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email || ''

    const requestBody = await request.json()
    let validatedRequest: TokenPaymentRequest
    try {
      validatedRequest = TokenPaymentRequestSchema.parse(requestBody)
    } catch (validationError) {
      logger.warn('Invalid token payment request', {
        userId,
        requestBody,
        validationError,
      })
      return NextResponse.json(
        { error: 'Invalid request data', details: validationError },
        { status: 400 },
      )
    }

    const { type, amount, auto_subscribe, toAddress } = validatedRequest

    const defaultUpgradeAmount = getMembershipRingUpgradeAmount()
    const defaultRenewalAmount = getMembershipRingRenewalAmount()
    const membershipFee =
      amount ??
      (type === 'subscription_renewal'
        ? defaultRenewalAmount.toString()
        : defaultUpgradeAmount.toString())
    const paymentAmount = parseFloat(membershipFee)

    if (paymentAmount <= 0 || paymentAmount > 100) {
      return NextResponse.json(
        {
          error: `Invalid payment amount. Must be between 0.01 and 100 ${getNativeTokenSymbol()}`,
        },
        { status: 400 },
      )
    }

    const onChainBalance = await getNativeTokenBalanceForUser(userId)
    if (parseFloat(onChainBalance.balance) < paymentAmount) {
      return NextResponse.json(
        {
          error: `Insufficient ${onChainBalance.tokenSymbol} balance for ${type} payment`,
          current_balance: onChainBalance.balance,
          required_amount: membershipFee,
          symbol: onChainBalance.tokenSymbol,
          chain: onChainBalance.chain,
        },
        { status: 400 },
      )
    }

    const symbol = getNativeTokenSymbol()
    let subscriptionResult:
      | Awaited<ReturnType<typeof SubscriptionConductor.createSubscription>>
      | Awaited<ReturnType<typeof SubscriptionConductor.renewSubscription>>
      | undefined
    let transferTxHash: string | undefined
    let fromAddress: string | undefined
    let responseMessage: string

    switch (type) {
      case 'membership_upgrade': {
        if (
          assertKnownUserRole(session.user.role as UserRolesArray) !==
          UserRolesArray.subscriber
        ) {
          return NextResponse.json(
            {
              error: 'Invalid upgrade request',
              message: 'Only Subscribers can upgrade to Member using native token',
              current_role: session.user.role,
            },
            { status: 400 },
          )
        }

        subscriptionResult = await SubscriptionConductor.createSubscription({
          userId,
          userEmail,
          provider: 'native_token',
          gateway: symbol,
          method: 'crypto',
          amount: paymentAmount,
          currency: symbol,
          gatewayFeePercent: 0,
          gatewayFeeFixed: 0,
          metadata: {
            source: 'token_payment',
            auto_renew: auto_subscribe,
            membershipProgramDeployed: isMembershipDeployed(),
          },
        })

        if (!subscriptionResult.success) {
          return NextResponse.json(
            {
              error:
                subscriptionResult.error || 'Native token membership upgrade failed',
            },
            { status: 400 },
          )
        }

        transferTxHash =
          subscriptionResult.txSignature ||
          ('gatewayReference' in subscriptionResult
            ? subscriptionResult.gatewayReference
            : undefined)
        responseMessage = auto_subscribe
          ? 'Upgraded to Member and created automatic subscription'
          : 'Upgraded to Member tier successfully'
        break
      }

      case 'subscription_renewal': {
        subscriptionResult = await SubscriptionConductor.renewSubscription(
          userId,
          'native_token',
        )
        if (!subscriptionResult.success) {
          return NextResponse.json(
            { error: subscriptionResult.error || 'Renewal failed' },
            { status: 400 },
          )
        }
        transferTxHash = subscriptionResult.txSignature
        responseMessage = 'Subscription renewed successfully'
        break
      }

      case 'membership_fee': {
        const treasury = resolveTreasuryOrError(toAddress)
        if (treasury.ok === false) {
          return treasury.response
        }
        const treasuryAddress = treasury.address

        try {
          const transferResult = await transferNativeTokenForUser({
            userId,
            toAddress: treasuryAddress,
            amount: membershipFee,
          })
          transferTxHash = transferResult.txHash
          fromAddress = transferResult.fromAddress
        } catch (transferError) {
          logger.error('On-chain native token transfer failed', {
            userId,
            error: transferError,
          })
          return NextResponse.json(
            {
              error: 'On-chain transfer failed',
              message:
                transferError instanceof Error
                  ? transferError.message
                  : 'Unknown error',
            },
            { status: 500 },
          )
        }
        responseMessage = 'Membership fee paid successfully'
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 })
    }

    const updatedSubscription = await SubscriptionConductor.getSubscription(userId)
    const treasuryForResponse = getNativeTokenTreasuryAddress()

    const response = {
      success: true,
      message: responseMessage,
      payment: {
        type,
        amount_paid: membershipFee,
        currency: symbol,
        chain: onChainBalance.chain,
        tx_hash: transferTxHash,
        from_address: fromAddress,
        to_address: treasuryForResponse,
        timestamp: Date.now(),
      },
      account: {
        new_balance: (parseFloat(onChainBalance.balance) - paymentAmount).toString(),
        subscription_status: updatedSubscription?.status || 'none',
        next_payment_due: updatedSubscription?.next_payment_due,
      },
      benefits_unlocked:
        type === 'membership_upgrade'
          ? [
              'Access to confidential opportunities',
              'Priority support',
              'Advanced entity creation',
              'Premium messaging features',
              'Analytics dashboard',
            ]
          : [],
    }

    logger.info('Token payment processed successfully', {
      userId,
      type,
      amount: membershipFee,
      txHash: transferTxHash,
      membershipProgramDeployed: isMembershipDeployed(),
      subscriptionId:
        subscriptionResult && 'subscriptionId' in subscriptionResult
          ? subscriptionResult.subscriptionId
          : undefined,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Failed to process token payment', { error })
    return NextResponse.json(
      { error: 'Failed to process token payment' },
      { status: 500 },
    )
  }
}

/**
 * GET /api/membership/payment/token
 *
 * Returns user's native token (RING) balance and available payment flows.
 */
export async function GET(request: NextRequest) {
  await connection()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const onChainBalance = await getNativeTokenBalanceForUser(userId)
    const currentBalance = parseFloat(onChainBalance.balance)
    const membershipFee = getMembershipRingUpgradeAmount()
    const symbol = getNativeTokenSymbol()
    const subscription = await SubscriptionConductor.getSubscription(userId)

    const paymentOptions: Array<Record<string, unknown>> = []

    if (
      assertKnownUserRole(session.user.role as UserRolesArray) ===
      UserRolesArray.subscriber
    ) {
      paymentOptions.push({
        type: 'membership_upgrade',
        title: 'Upgrade to Member',
        description: 'One-time upgrade with optional auto-renewal',
        cost: {
          ring_amount: membershipFee.toFixed(2),
          currency: symbol,
        },
        available: currentBalance >= membershipFee,
        benefits: [
          'Immediate access to Member features',
          'Optional automatic monthly renewals',
          'Cancel anytime',
        ],
      })
    }

    if (
      subscription?.status === 'expired' ||
      (subscription?.next_payment_due && subscription.next_payment_due < Date.now())
    ) {
      paymentOptions.push({
        type: 'subscription_renewal',
        title: 'Renew Subscription',
        description: 'Renew your membership for another month',
        cost: {
          ring_amount: membershipFee.toFixed(2),
          currency: symbol,
        },
        available: currentBalance >= membershipFee,
        benefits: [
          'Restore Member access',
          'Reset payment schedule',
          'Continue with current benefits',
        ],
      })
    }

    paymentOptions.push({
      type: 'membership_fee',
      title: 'One-time Payment',
      description: 'Pay membership fee without subscription',
      cost: {
        ring_amount: membershipFee.toFixed(2),
        currency: symbol,
      },
      available: currentBalance >= membershipFee,
      benefits: [
        'No automatic renewals',
        'Pay as needed',
        'Full control over payments',
      ],
    })

    return NextResponse.json({
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
          currency: symbol,
        },
        discounts: [],
        fees: {
          processing_fee: '0',
          network_fee: '0',
          platform_fee: '0',
        },
      },
      payment_options: paymentOptions,
      requirements: {
        minimum_balance: membershipFee.toFixed(2),
        balance_shortfall: Math.max(0, membershipFee - currentBalance).toString(),
        top_up_needed: currentBalance < membershipFee,
      },
      next_steps:
        currentBalance >= membershipFee
          ? [
              'Select payment type',
              'Confirm payment details',
              'Complete on-chain transfer',
              'Access Member features',
            ]
          : ['Top up native token balance', 'Return to complete payment'],
    })
  } catch (error) {
    logger.error('Failed to get token payment information', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve payment information' },
      { status: 500 },
    )
  }
}
