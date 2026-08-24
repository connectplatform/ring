import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { PaymentConductor } from '@/lib/payments/conductor/payment-conductor'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { buildOrderReference } from '@/lib/payments/order-reference'
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
import { getNativeTokenConfig, isRailEnabled } from '@/lib/payments/payment.config'
import { isMembershipDeployed } from '@/lib/payments/subscription/ring-membership-config'
import { membershipApiPaymentBodySchema } from '@/lib/zod/membership-schemas'

/**
 * Native token payment — extends shared membership API body (auto_subscribe defaults false).
 */
const TokenPaymentRequestSchema = membershipApiPaymentBodySchema.extend({
  auto_subscribe: z.boolean().default(false),
  /** Idempotency contract: retries with the same key replay, never double-charge. */
  idempotencyKey: z.string().min(8).max(120).optional(),
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
 * Non-blocking unified ledger write (payment_transactions, purpose membership_upgrade).
 * Mirrors the card (WFP webhook) composition — payment success must never fail on an
 * audit-row write, so DB errors are logged and swallowed (reconcilable via cron).
 */
async function recordMembershipNativeLedger(
  userId: string,
  paymentAmount: number,
  symbol: string,
  fee: string,
  txHash: string,
  extra?: { fromAddress?: string; toAddress?: string; idempotencyKey?: string },
): Promise<void> {
  try {
    const orderReference = buildOrderReference('membership_upgrade', { userId })
    await paymentTransactionService.createPending({
      purpose: 'membership_upgrade',
      processor: 'native_token',
      rail: 'native_token',
      orderReference,
      entityType: 'membership_upgrade',
      entityId: userId,
      userId,
      amountMinor: Math.round(paymentAmount * 1e6),
      currency: symbol,
      idempotencyKey: extra?.idempotencyKey,
    })
    await paymentTransactionService.markPaid(orderReference, {
      rail: 'native_token',
      txHash,
      tokenAmount: fee,
      tokenSymbol: symbol,
      contractAddress: getNativeTokenConfig().contractAddress,
      ...(extra?.fromAddress ? { fromAddress: extra.fromAddress } : {}),
      ...(extra?.toAddress ? { toAddress: extra.toAddress } : {}),
    })
  } catch (error) {
    logger.warn('Membership native ledger row write failed (non-blocking)', {
      userId,
      error: error instanceof Error ? error.message : error,
    })
  }
}

/**
 * POST /api/membership/payment/token
 *
 * Native-token membership via SubscriptionConductor, with unified ledger parity:
 * - Membership program deployed → on-chain create/renew (program deducts) + payment_transactions row
 * - Soft launch (empty membershipProgramId) → PaymentConductor rail native_token +
 *   purpose membership_upgrade (treasury SPL + payment_transactions), then
 *   SubscriptionConductor ledger-only via metadata.tx_hash (no second transfer)
 * One-shot `membership_fee` → treasury SPL + payment_transactions row (no subscription_ledger)
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

    const { type, amount, auto_subscribe, toAddress, idempotencyKey } = validatedRequest

    const defaultUpgradeAmount = getMembershipRingUpgradeAmount()
    const defaultRenewalAmount = getMembershipRingRenewalAmount()
    // Renewal transfers the pricing default inside the provider (custom amount is
    // not honored by renewSubscription) — force the default so that the balance
    // check, payment_transactions ledger row and response all stay aligned.
    const membershipFee =
      type === 'subscription_renewal'
        ? defaultRenewalAmount.toString()
        : (amount ?? defaultUpgradeAmount.toString())
    const paymentAmount = parseFloat(membershipFee)

    if (paymentAmount <= 0 || paymentAmount > 100) {
      return NextResponse.json(
        {
          error: `Invalid payment amount. Must be between 0.01 and 100 ${getNativeTokenSymbol()}`,
        },
        { status: 400 },
      )
    }

    const symbol = getNativeTokenSymbol()

    // Single rail gate for ALL native membership types (upgrade / renewal / fee).
    // Mirrors PaymentConductor's own guard — explicit here so the on-chain
    // (deployed) path is gated exactly like the soft-launch path.
    if (!isRailEnabled('membership_upgrade', 'native_token')) {
      return NextResponse.json(
        {
          error: 'Native token membership payments are disabled',
          code: 'NATIVE_TOKEN_RAIL_DISABLED',
          message: 'Enable native_token in payment.supportedMethods',
        },
        { status: 403 },
      )
    }

    // Idempotency contract (same as desk / nft listings / public pools): a client-
    // supplied key replays a completed payment instead of charging the treasury twice.
    // MUST run before the balance check — a drained balance after a successful first
    // attempt must not block the replay.
    if (idempotencyKey) {
      const existing = await paymentTransactionService.findByIdempotencyKey(
        userId,
        'membership_upgrade',
        idempotencyKey,
      )
      if (existing) {
        if (existing.status === 'paid') {
          const replayedTx =
            (existing.processor_payload as { txHash?: string } | undefined)?.txHash
          const [updatedSubscription, replayBalance] = await Promise.all([
            SubscriptionConductor.getSubscription(userId),
            getNativeTokenBalanceForUser(userId),
          ])
          logger.info('Membership native payment: idempotent replay', {
            userId,
            type,
            orderReference: existing.order_reference,
          })
          return NextResponse.json({
            success: true,
            idempotent_replay: true,
            message: 'Payment already completed',
            payment: {
              type,
              amount_paid: membershipFee,
              currency: symbol,
              chain: replayBalance.chain,
              tx_hash: replayedTx ?? existing.order_reference,
              order_reference: existing.order_reference,
              timestamp: Date.now(),
            },
            account: {
              new_balance: replayBalance.balance,
              subscription_status: updatedSubscription?.status || 'none',
              next_payment_due: updatedSubscription?.next_payment_due,
            },
          })
        }
        return NextResponse.json(
          {
            error: 'Payment with this idempotency key is already in progress',
            code: 'IDEMPOTENCY_IN_FLIGHT',
            orderReference: existing.order_reference,
          },
          { status: 409 },
        )
      }
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

        const membershipDeployed = isMembershipDeployed()

        if (!membershipDeployed) {
          // Soft-launch: PaymentConductor native processor moves funds (treasury SPL)
          // AND writes the unified payment_transactions row (purpose membership_upgrade,
          // rail native_token) — identical ledger shape to store native checkout.
          // metadata.tokenAmount = explicit native units (no oracle round-trip).
          const checkout = await PaymentConductor.createCheckout({
            purpose: 'membership_upgrade',
            rail: 'native_token',
            userId,
            userEmail,
            entityId: userId,
            orderId: userId,
            amount: paymentAmount,
            currency: symbol,
            metadata: {
              tokenAmount: membershipFee,
              ...(idempotencyKey ? { idempotencyKey } : {}),
            },
            returnUrl: '',
          })
          if (!checkout.success || !checkout.paid) {
            return NextResponse.json(
              {
                error: checkout.error || 'Native token membership payment failed',
                code: checkout.code,
                orderReference: checkout.orderReference,
              },
              { status: 400 },
            )
          }
          transferTxHash = checkout.txHash
        }

        // SubscriptionConductor: soft-launch = ledger-only via metadata.tx_hash
        // (nativeTokenSubscriptionProvider skips the second transfer); deployed =
        // on-chain Membership create (program deducts).
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
            membershipProgramDeployed: membershipDeployed,
            ...(transferTxHash ? { tx_hash: transferTxHash } : {}),
            ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
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
          transferTxHash ||
          subscriptionResult.txSignature ||
          ('gatewayReference' in subscriptionResult
            ? subscriptionResult.gatewayReference
            : undefined)

        // Deployed path: on-chain Membership deducted the fee — PaymentConductor was
        // NOT used (would double-charge). Write the unified payment_transactions row
        // manually so membership native has the same ledger shape as card (WFP/Stripe).
        if (membershipDeployed && transferTxHash) {
          await recordMembershipNativeLedger(
            userId,
            paymentAmount,
            symbol,
            membershipFee,
            transferTxHash,
            { idempotencyKey },
          )
        }

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
        // Ledger parity: record the renewal in the unified payment_transactions ledger
        // (mirrors card renewals, which flow through WFP webhook markPaid). Renewal
        // keeps its existing SubscriptionConductor transfer flow — no double charge.
        if (transferTxHash) {
          await recordMembershipNativeLedger(
            userId,
            paymentAmount,
            symbol,
            membershipFee,
            transferTxHash,
            { idempotencyKey },
          )
        }
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
        // Ledger parity: one-shot fee still records the unified payment_transactions
        // row (no subscription_ledger — documented one-shot semantics).
        if (transferTxHash) {
          await recordMembershipNativeLedger(
            userId,
            paymentAmount,
            symbol,
            membershipFee,
            transferTxHash,
            { fromAddress, toAddress: treasuryAddress, idempotencyKey },
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
          native_token_amount: membershipFee.toFixed(2),
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
          native_token_amount: membershipFee.toFixed(2),
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
        native_token_amount: membershipFee.toFixed(2),
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
          native_token_amount: membershipFee.toFixed(2),
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
