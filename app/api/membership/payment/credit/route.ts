/**
 * POST /api/membership/payment/credit
 * GET  /api/membership/payment/credit
 *
 * Process membership fee payment via user credit balance (fiat USD).
 * - SSOT: All credits are fiat USD on ring-platform.org (never RING denomination).
 *
 * Dedicated endpoint (does not overlap with):
 * - /api/membership/payment/token → RING-native on-chain payments
 * - /api/membership/payment/card  → Stripe/WayForPay
 *
 * Utilizes SubscriptionConductor facade (Phases S0–S6) with provider 'credit_balance'
 *
 * // TODO: In Next.js 13–16, prefer using Route Handlers. 
 * If file uses the new /app API, ensure usage of Next.js's router conventions for caching/revalidation.
 */

import { NextRequest, NextResponse, connection } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { ALL_USER_ROLES, UserRolesArray } from '@/features/auth/user-role'
import { getCreditCurrencyCode } from '@/lib/payments/credit-currency'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import { nativeTokenPriceOracleService } from '@/features/wallet/services/native-token-price-oracle'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { SubscriptionConductor } from '@/lib/payments/subscription/subscription-conductor'
import { getGatewayConfig } from '@/lib/payments/subscription/subscription-config'

// Zod schema validation for payment POST payload
const CreditPaymentRequestSchema = z.object({
  type: z.enum(['membership_upgrade', 'subscription_renewal', 'membership_fee']),
  auto_subscribe: z.boolean().default(false),
})
type CreditPaymentRequest = z.infer<typeof CreditPaymentRequestSchema>

/**
 * Computes the membership fee for the current credit currency.
 * @param currency - The currency in which the fee should be returned
 * @returns membership fee in requested currency (usually USD)
 *
 * - Reads config from ring-config.json
 * - By default uses member tier, falls back to subscriber
 * - TODO: Add real currency conversion support using price oracle if credits ever support FX
 */
async function computeMembershipFee(currency: string): Promise<number> {
  const config = getSystemConfigSnapshot() // Current static configuration snapshot
  const tiers = config.membership?.tiers
  if (!tiers) throw new Error('membership.tiers not configured in ring-config.json')

  // Use 'member' by default, fallback to 'subscriber'
  const tier = tiers.member ?? tiers.subscriber
  if (!tier) throw new Error('No membership tier configured')

  // Fee is in the tier's currency (e.g., USD for ring-platform.org)
  const amount = Number(tier.amount ?? 0)
  if (currency.toUpperCase() === (tier.currency ?? currency).toUpperCase()) {
    // Currencies match: No conversion needed
    return amount
  }

  // Foreign exchange conversion required, stubbed for now
  try {
    const nativePrice = nativeTokenPriceOracleService // // STUB: Implement currency conversion based on FX oracle if/when needed
    if (nativePrice) {
      // STUB: Implement logic: convert amount in tier.currency → USD → target credit currency
      // TODO: Implement conversion using nativeTokenPriceOracleService when/if non-USD tokens are allowed
    }
  } catch {
    // On error, just fallback — user will see correct amount in base units
  }
  return amount
}

/**
 * POST Handler: Spend user credits to pay membership fee.
 *
 * Core logic flow:
 *  1. Authenticate user using session.
 *  2. Validate the request body using Zod schema.
 *  3. Compute the required fee (in credit currency).
 *  4. Check for sufficient credit balance.
 *  5. If insufficient: Return 400 with balance and top-up link.
 *  6. If sufficient: Spend the credits (debit user's fiat USD credit balance).
 *  7. Try to create a subscription_ledger entry via SubscriptionConductor (if applicable).
 *  8. Revalidate relevant paths for Next.js ISR/cache.
 *  9. Log success, return payment and updated account info.
 */
export async function POST(request: NextRequest) {
  // Ensure database connection is established for each request
  await connection()

  try {
    // Authenticate session using NextAuth or custom method
    const session = await auth()
    if (!session?.user?.id) {
      // Not authenticated, bail out with 401
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email ?? ''
    // Get the currency code for credits (usually 'USD')
    const creditCurrency = getCreditCurrencyCode()

    // Parse request body safely (fallback to empty if any error)
    const body = await request.json().catch(() => ({}))
    const parsed = CreditPaymentRequestSchema.safeParse(body)
    if (!parsed.success) {
      // Bad payload: send error and flatten Zod errors
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Extract type and auto_subscribe from parsed body
    const { type, auto_subscribe } = parsed.data
    // Look up the current credit fee for the user's target tier
    const amount = await computeMembershipFee(creditCurrency)
    // Subscription gateway config for possible gateway fees
    const gwConfig = getGatewayConfig('credit_balance')

    // Check if the user has enough balance for the payment
    const hasBalance = await creditBalanceService.hasSufficientBalance(userId, String(amount))
    if (!hasBalance) {
      // If insufficient, fetch the current balance and return error info with required amount
      const balance = await creditBalanceService.getUserCreditBalance(userId)
      return NextResponse.json(
        {
          error: 'Insufficient credit balance',
          current_balance: balance?.amount ?? '0',
          currency: creditCurrency,
          required_amount: String(amount),
          top_up_url: '/wallet/topup',
        },
        { status: 400 }
      )
    }

    // User has sufficient balance: Attempt to spend credits (SSOT: creditBalanceService)
    const result = await creditBalanceService.spendCredits(
      userId,
      {
        amount: String(amount),
        description: `Membership ${type} via credit balance`,
        metadata: { type, source: 'credit_balance_payment' },
      },
      'membership_fee', // Transaction category
      '1', // USD rate for fiat credits (no FX)
    )
    // TODO: Prefer passing numbers in all APIs and limiting string conversions to IO boundaries.

    // Try to create a subscription_ledger entry if upgrading/renewal/etc via SubscriptionConductor
    let subscriptionId: string | undefined
    if (type === 'membership_upgrade' || auto_subscribe) {
      try {
        // Create a new subscription ledger row for the payment (needed for upgrades)
        const subResult = await SubscriptionConductor.createSubscription({
          userId,
          userEmail,
          provider: 'credit_balance',
          gateway: 'RING Credits',
          method: 'credit_balance',
          amount,
          currency: creditCurrency,
          gatewayFeePercent: gwConfig?.feePercent ?? 0,
          gatewayFeeFixed: gwConfig?.feeFixedCents ?? 0,
          metadata: { type, source: 'credit_balance_payment' },
        })
        subscriptionId = subResult.subscriptionId
      } catch (subError) {
        // If the ledger creation fails, log a warning, but still process the payment
        logger.warn('Credit payment: subscription_ledger create failed (non-fatal)', {
          userId,
          error: subError instanceof Error ? subError.message : subError,
        })
      }
    }

    // Invalidate/revalidate cached data for the Wallet/Profile dashboards
    revalidateSafe('/[locale]/wallet')
    revalidateSafe('/[locale]/profile')
    // TODO: In Next.js 13+, consider using revalidateTag for more granular cache control if tags are implemented.

    // Log the successful payment event with the details
    logger.info('Credit balance payment processed', {
      userId,
      type,
      amount,
      currency: creditCurrency,
      newBalance: result.newBalance,
      subscriptionId,
    })

    // Send JSON response with payment result and updated account state
    return NextResponse.json({
      success: true,
      message: `Membership payment of ${amount} ${creditCurrency} processed via credit balance`,
      payment: {
        type,
        amount_paid: String(amount),
        currency: creditCurrency,
        transaction_id: result.transaction.id,
        timestamp: Date.now(),
      },
      account: {
        new_balance: result.newBalance,
        subscription_id: subscriptionId,
      },
    })
  } catch (error) {
    // Handle unexpected errors and log them for diagnostics
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Credit balance payment failed', { error: message })
    return NextResponse.json({ error: 'Failed to process credit balance payment' }, { status: 500 })
  }
}

/**
 * GET Handler: Returns pricing and user's current credit balance.
 *
 * Core logic flow:
 *  1. Authenticate user
 *  2. Get userId and current credit currency
 *  3. Fetch latest credit balance & current subscription info in parallel
 *  4. Compute required membership fee (in credit currency)
 *  5. Respond with all relevant info for client to render payment/upgrade flow
 */
export async function GET(request: NextRequest) {
  // Database connection, as with all endpoint handlers
  await connection()

  try {
    // Auth required for retrieving sensitive account info
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const creditCurrency = getCreditCurrencyCode()

    // In parallel: Get user's current credit balance and subscription
    // TODO: In React 19/Next 16: Could use use() for async data when in Server Components (not expressible in route handlers yet)
    const [balance, subscription] = await Promise.all([
      creditBalanceService.getUserCreditBalance(userId),
      SubscriptionConductor.getSubscription(userId),
    ])

    // Compute membership fee for this user/currency
    const amount = await computeMembershipFee(creditCurrency)

    // Construct response with all relevant account/subscription/payment info
    return NextResponse.json({
      payment_method: 'credit_balance',
      currency: creditCurrency,
      membership_fee: { amount, currency: creditCurrency },
      user: {
        current_balance: balance?.amount ?? '0',
        balance_sufficient: balance ? parseFloat(balance.amount) >= amount : false,
        current_tier: ALL_USER_ROLES.includes(session.user.role as UserRolesArray) ? session.user.role : 'none',
        subscription_status: subscription?.status ?? 'none',
      },
      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            status: subscription.status,
            next_payment_due: subscription.next_payment_due,
          }
        : null,
      top_up_url: '/wallet/topup', // Universal link to top up credit balance
    })
  } catch (error) {
    // On error, log and communicate generic failure
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Credit balance info failed', { error: message })
    return NextResponse.json({ error: 'Failed to get credit balance info' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Utility: Safe revalidate cache path
// ---------------------------------------------------------------------------
/**
 * Tries to revalidate ISR cache for given path using dynamic import.
 * No-op in environments (like middleware or certain lambda runtimes) 
 * where revalidatePath is not available.
 *
 * // TODO: In Next.js 16+ consider using revalidateTag for more granular invalidation.
 * // TODO: Codemod: extract this to utilities or handle via built-in router cache tags
 */
async function revalidateSafe(path: string): Promise<void> {
  try {
    const { revalidatePath } = await import('next/cache')
    revalidatePath(path)
  } catch {
    // Safe ignore: Not dynamic SSR context or not server-only compiled
  }
}
