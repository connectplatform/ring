'use server'

/**
 * Membership Server Actions — Ring Platform
 * 
 * This file defines all critical server actions for membership:
 * - Credit, Native Token, and Card payment for membership
 * - Subscription lifecycle management
 * - Pricing/stat retrieval
 * 
 * Design Patterns:
 * - Dynamic SSR-only imports to keep client bundle lean
 * - Next.js revalidations after mutations (with `revalidatePath`)
 * - Clear return objects for use in React 19 useActionState
 * - Optimistic server error/log handling
 * - Top-of-function authentication gate
 * 
 * // TODO: When React 19 & Next 16 are stable, migrate to React `useServerAction` and server-form actions. See https://react.dev/reference/react/useServerAction and Next.js beta docs.
 * // TODO: Consider using Zod or similar for strong runtime validation of incoming FormData. See: https://github.com/colinhacks/zod
 */

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { getMemberFiatTier } from '@/lib/membership/pricing'

// ============================================================================
// TYPES
// ============================================================================

export interface MembershipActionResult {
  success: boolean
  error?: string
  message?: string
}

export interface PricingResult extends MembershipActionResult {
  membershipFee?: string
  currency?: string
  usdEquivalent?: string
  exchangeRate?: string
  paymentOptions?: Array<{
    type: string
    title: string
    description: string
    cost: { token_amount: string; usd_equivalent: string }
    available: boolean
    benefits: string[]
  }>
  currentBalance?: string
  balanceSufficient?: boolean
}

export interface SubscriptionResult extends MembershipActionResult {
  subscription?: {
    id?: string
    status: string
    provider?: string
    gateway?: string
    start_time?: number
    next_payment_due?: number
    auto_renew?: boolean
    total_paid?: string
    payments_count?: number
  }
}

// ============================================================================
// 1. PAY WITH CREDIT BALANCE
// ============================================================================

/**
 * Pay a membership fee using a user's credit balance (fiat USD).
 * - Supports upgrade, renewal, and one-time fee types.
 * - Checks for sufficient balance before proceeding.
 * - Handles optional auto-subscribe logic.
 * - Dynamically imports credit service for server-only code.
 * - Returns structured result for React 19 useActionState.
 * 
 * // TODO: Migrate to useServerAction (React 19) when stable, replacing manual FormData extraction and manual mutation return structures.
 * // TODO: Use Zod for all input validation.
 */
export async function payWithCreditBalance(formData: FormData): Promise<MembershipActionResult & {
  transactionId?: string
  newBalance?: string
  subscriptionStatus?: string
  autoSubscribed?: boolean
}> {
  try {
    // Step 1: Auth check (prevents all downstream ops if not logged in)
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    const userId = session.user.id
    // Parse payment intent type from form
    const type = formData.get('type') as 'membership_upgrade' | 'subscription_renewal' | 'membership_fee'
    const autoSubscribe = formData.get('auto_subscribe') === 'true'
    // If amount is unspecified, fallback to configured fee/tier, else '1.0'
    const membershipFee = formData.get('amount') as string || getMemberFiatTier()?.amount.toString() || '1.0'

    // Input validation: require payment type
    if (!type)
      return {
        success: false,
        error: 'Payment type is required (membership_upgrade, subscription_renewal, or membership_fee)'
      }

    // SSR dynamic import for server-side logic (keeps client lean)
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')

    // Fetch user's current credit balance from DB/cache
    const balance = await creditBalanceService.getUserCreditBalance(userId)
    if (!balance || parseFloat(balance.amount) < parseFloat(membershipFee)) {
      return {
        success: false,
        error: 'Insufficient credit balance',
        message: `Required: ${membershipFee}, Available: ${balance?.amount || '0'}. Please top up at /wallet/topup`,
      }
    }

    const paymentAmount = parseFloat(membershipFee)
    let result: any // All mutations place result in here for shaped response
    let autoSubscribed = false

    switch (type) {
      case 'membership_upgrade': {
        // Attempt to deduct user's credits for membership upgrade
        result = await creditBalanceService.spendCredits(
          userId,
          {
            amount: membershipFee,
            description: 'Membership upgrade via credit balance',
            metadata: { type: 'membership_upgrade' }
          },
          'membership_fee',
          '1', // STUB: Clarify or refactor magic string argument. // STUB: Step 1, identify meaning of '1' (is version/type code?), refactor to enum/constant in creditBalanceService args.
        )

        // Handle optional auto-subscribe intent (create subscription in SSOT)
        if (autoSubscribe) {
          const { SubscriptionConductor } = await import('@/lib/payments/subscription/subscription-conductor')
          const subResult = await SubscriptionConductor.createSubscription({
            userId,
            userEmail: session.user.email || '',
            provider: 'credit_balance',
            gateway: 'Credit Balance',
            method: 'credit_balance',
            amount: paymentAmount,
            currency: 'USD',
            gatewayFeePercent: 0,
            gatewayFeeFixed: 0,
            metadata: { auto_renew: true, target_role: 'MEMBER' }
          })
          if (subResult.success) autoSubscribed = true
          // TODO: Add more granular error handling for SubscriptionConductor failure if needed.
        }
        break
      }

      case 'subscription_renewal': {
        // Renew subscription using SSOT - handles idempotency, double-charge, etc.
        const { SubscriptionConductor } = await import('@/lib/payments/subscription/subscription-conductor')
        const renewResult = await SubscriptionConductor.renewSubscription(userId, 'credit_balance')
        if (!renewResult.success) {
          return {
            success: false,
            error: renewResult.error || 'Renewal failed'
          }
        }
        // STUB: Fake transaction (renewal handled elsewhere). // STUB: Step 2, refactor so transaction/result always reflects actual ledger event.
        result = {
          success: true,
          transaction: { id: `renewal_${Date.now()}` },
          newBalance: (parseFloat(balance.amount) - paymentAmount).toString()
        }
        break
      }

      case 'membership_fee': {
        // One-shot processing for simple payment (non-subscription)
        result = await creditBalanceService.processMembershipFee(userId, membershipFee, '1')
        // STUB: '1' magic arg above should be constant not literal
        break
      }

      // TODO: Consider adding an explicit error throw/fail for unexpected types for dev safety.
    }

    // Invalidate path-based Next.js caches for wallet/profile post-mutation
    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: `${type.replace('_', ' ')} completed successfully`,
      transactionId: result?.transaction?.id,
      newBalance: result?.newBalance,
      autoSubscribed,
    }
  } catch (error) {
    // Catch all errors, log w/ context, return user-friendly message
    logger.error('payWithCreditBalance failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Credit payment failed',
    }
  }
}

// ============================================================================
// 2. PAY WITH NATIVE TOKEN
// ============================================================================

/**
 * Pay membership fee using native-chain token (e.g. RING, SOL, ETH, etc.)
 * - Checks user's native token balance on-chain.
 * - Executes transfer (treasury-sponsoring gas fees).
 * - Provisions a subscription for upgrades if needed.
 *
 * // TODO: useServerAction for direct mutation and React 19 pattern ergonomics.
 */
export async function payWithNativeToken(formData: FormData): Promise<MembershipActionResult & {
  txHash?: string
}> {
  try {
    // Step 1: Require login/auth for all actions
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    // Parse intent/type + fallback amount (from tier/db/config else 1.0)
    const type = formData.get('type') as string
    const amount = formData.get('amount') as string || getMemberFiatTier()?.amount.toString() || '1.0'

    if (!type)
      return { success: false, error: 'Payment type is required' }

    // SSR dynamic import for chain service to get user's on-chain balance
    const { getNativeTokenBalanceForUser } = await import('@/features/wallet/chains/native-token-transfer-service')
    const onChain = await getNativeTokenBalanceForUser(session.user.id)
    if (parseFloat(onChain.balance) < parseFloat(amount)) {
      // Return specific error so client can offer "top up" UX
      return {
        success: false,
        error: `Insufficient native token balance. Required: ${amount} ${onChain.tokenSymbol}, Available: ${onChain.balance}`,
        message: `Please acquire more ${onChain.tokenSymbol} tokens via the desk widget on /wallet`,
      }
    }

    // SSR dynamic import for blockchain transfer logic (covers gas fees)
    const { transferTokenToTreasury } = await import('@/features/wallet/chains/solana/treasury-transfer-service')
    // Fetch user's native wallet (assume Solana for MVP initial implementation)
    const wallet = await import('@/lib/wallet/user-wallet-db').then(m => m.getNativeWallet(session.user.id, 'solana'))
    if (!wallet) {
      return { success: false, error: 'No Solana wallet found. Please ensure your wallet first.' }
    }
    const { nativeTokenUiToRaw } = await import('@/lib/wallet/native-token-amount')
    const amountRaw = nativeTokenUiToRaw(amount)
    const transfer = await transferTokenToTreasury(wallet, amountRaw)

    // If "membership_upgrade" also provision subscription
    if (type === 'membership_upgrade') {
      const { SubscriptionConductor } = await import('@/lib/payments/subscription/subscription-conductor')
      const tokenSymbol = getNativeTokenSymbol()
      // Write to subscription SSOT for this user
      await SubscriptionConductor.createSubscription({
        userId: session.user.id,
        userEmail: session.user.email || '',
        provider: 'native_token' as const,
        gateway: tokenSymbol,
        method: 'crypto',
        amount: parseFloat(amount),
        currency: tokenSymbol,
        gatewayFeePercent: 0,
        gatewayFeeFixed: 0,
        metadata: {
          auto_renew: formData.get('auto_subscribe') === 'true',
          target_role: 'MEMBER',
          txHash: transfer.txHash, // cross-links on-chain payment with ledger event
          tokenAddress: wallet.address,
        }
      })
      // TODO: Refactor payment+subscription into atomic transaction once feasible.
    }

    // Next.js cache invalidation for dirty data on wallet/profile
    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: `Native token payment of ${amount} ${getNativeTokenSymbol()} completed`,
      txHash: transfer.txHash,
    }
  } catch (error) {
    logger.error('payWithNativeToken failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Native token payment failed',
    }
  }
}

// ============================================================================
// 3. PAY WITH CARD
// ============================================================================

/**
 * Initiate a card payment for membership (Stripe/WayForPay).
 * - Returns a checkout URL for client to redirect.
 * - Handles admin-only variable-amount override.
 * 
 * // TODO: Consider refactoring to expose "native" React action for direct server-form handling, see Next.js form actions docs.
 */
export async function payWithCard(formData: FormData): Promise<MembershipActionResult & {
  paymentUrl?: string
  paymentFields?: Record<string, string | string[]>
  redirect?: {
    mode: 'navigate' | 'form_post'
    url: string
    fields?: Record<string, string | string[]>
  }
  orderReference?: string
}> {
  try {
    // Step 1: Gate all actions via server authentication
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    // Card processor/provider (defaults to Stripe, can override per env or form)
    const provider = formData.get('provider') as string || process.env.CARD_PAYMENT_PROCESSOR || 'stripe'
    // Use tier for amount unless admin supplies explicit value
    const amount = formData.get('amount') as string || getMemberFiatTier()?.amount.toString() || '1.0'
    // Redirect-after-payment URL
    const returnUrl = formData.get('returnUrl') as string || '/profile'

    // Amount limits for non-admin users; admin can override
    if (!isPlatformAdmin(session.user.role)) {
      const parsed = parseFloat(amount)
      if (isNaN(parsed) || parsed <= 0 || parsed > 100)
        return { success: false, error: 'Invalid payment amount. Must be between 0.01 and 100.' }
    }

    // Stripe (default) flow
    if (provider === 'stripe') {
      const { stripeSubscriptionProvider } = await import('@/lib/payments/subscription/providers/stripe-subscription')
      const result = await stripeSubscriptionProvider.createSubscription({
        userId: session.user.id,
        userEmail: session.user.email || '',
        provider: 'stripe',
        gateway: 'Stripe',
        method: 'card',
        amount: parseFloat(amount),
        currency: 'USD',
        gatewayFeePercent: 0,
        gatewayFeeFixed: 0,
        metadata: {
          auto_renew: formData.get('auto_subscribe') === 'true',
          target_role: 'MEMBER'
        }
      })

      if (!result.success)
        return { success: false, error: result.error || 'Stripe payment initiation failed' }

      return {
        success: true,
        message: 'Redirecting to Stripe checkout',
        paymentUrl: result.redirectUrl,
        orderReference: result.subscriptionId,
      }
    }

    // Ukrainian Hryvnia/WayForPay provider
    if (provider === 'wayforpay') {
      const { wayforpaySubscriptionProvider } = await import('@/lib/payments/subscription/providers/wayforpay-subscription')
      const result = await wayforpaySubscriptionProvider.createSubscription({
        userId: session.user.id,
        userEmail: session.user.email || '',
        provider: 'wayforpay' as const,
        gateway: 'WayForPay',
        method: 'card',
        amount: parseFloat(amount),
        currency: 'UAH',
        gatewayFeePercent: 0,
        gatewayFeeFixed: 0,
        metadata: { auto_renew: formData.get('auto_subscribe') === 'true', target_role: 'MEMBER' },
      })

      if (!result.success) {
        return { success: false, error: result.error || 'WayForPay payment not yet implemented' }
      }

      return {
        success: true,
        paymentUrl: result.redirectUrl,
        paymentFields: result.paymentFields,
        redirect: result.redirect,
        orderReference: result.subscriptionId,
      }
    }

    // Fallback for all unknown/unsupported providers
    return { success: false, error: `Unsupported card provider: ${provider}` }
  } catch (error) {
    logger.error('payWithCard failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Card payment failed',
    }
  }
}

// ============================================================================
// 4. GET MEMBERSHIP PRICING
// ============================================================================

/**
 * Get membership pricing incl. available payment options for the current user.
 * - Gets fiat + native token balances, price oracles
 * - Returns all suitable payment methods, with balance sufficient flags
 * 
 * // TODO: Consider refactor to enable React Suspense SSR for loading/instant UI.
 */
export async function getMembershipPricing(): Promise<PricingResult> {
  try {
    // Require login to calculate balances/options
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    // Dynamic SSR imports for server storage/chain logic
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')
    const { nativeTokenPriceOracleService } = await import('@/features/wallet/services/native-token-price-oracle')
    const { getNativeTokenBalanceForUser } = await import('@/features/wallet/chains/native-token-transfer-service')

    const memberTier = getMemberFiatTier()
    if (!memberTier)
      return { success: false, error: 'Member tier not configured' }

    const membershipFee = memberTier.amount
    // Fetch user's credit balance (may be 0 if uninitialized)
    const creditBalance = await creditBalanceService.getUserCreditBalance(session.user.id)
    const currentBalance = parseFloat(creditBalance?.amount || '0')

    // Try fetch on-chain native token balance (may fail if no chain wallet)
    let nativeTokenBalance = '0'
    try {
      const onChain = await getNativeTokenBalanceForUser(session.user.id)
      nativeTokenBalance = onChain.balance
    } catch {
      // Suppress chain balance fetch errors.
    }

    // Try fetch USD rate for native token (not critical, fallback to '1.00')
    let usdRate = '1.00'
    try {
      // STUB: nativeTokenPriceOracleService.getNativeTokenUsdPrice expects float symbol, which is likely incorrect—should use chain+token
      // STUB: Step 3: patch priceOracleService to accept real token symbols, not parseFloat.
      const priceData = await nativeTokenPriceOracleService.getNativeTokenUsdPrice(parseFloat(getNativeTokenSymbol()))
      if (priceData?.price) usdRate = priceData.price
    } catch {
      // Suppress price oracle failures
    }

    // Compute USD price for configured fee
    const usdCost = (membershipFee * parseFloat(usdRate)).toFixed(2)
    const tokenSymbol = getNativeTokenSymbol()

    const paymentOptions = [
      {
        type: 'credit_balance',
        title: 'Credit Balance',
        description: 'Pay with your credit balance (fiat USD)',
        cost: { token_amount: membershipFee.toFixed(2), usd_equivalent: usdCost },
        available: currentBalance >= membershipFee,
        benefits: ['Instant processing', 'No additional fees'],
      },
      {
        type: 'native_token',
        title: `Pay with ${tokenSymbol}`,
        description: `Pay with your ${tokenSymbol} token balance`,
        cost: { token_amount: membershipFee.toFixed(2), usd_equivalent: usdCost },
        available: parseFloat(nativeTokenBalance) >= membershipFee,
        benefits: ['Gas sponsored by treasury', 'No wallet required'],
      },
      {
        type: 'card',
        title: 'Credit/Debit Card',
        description: 'Pay with Visa, Mastercard, or Apple Pay',
        cost: { token_amount: membershipFee.toFixed(2), usd_equivalent: usdCost },
        available: true,
        benefits: ['Secure payment', 'Instant activation'],
      },
    ]

    return {
      success: true,
      membershipFee: membershipFee.toFixed(2),
      currency: 'USD',
      usdEquivalent: usdCost,
      exchangeRate: usdRate,
      paymentOptions,
      currentBalance: currentBalance.toFixed(2),
      balanceSufficient: currentBalance >= membershipFee,
    }
  } catch (error) {
    logger.error('getMembershipPricing failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pricing',
    }
  }
}

// ============================================================================
// 5. CREATE SUBSCRIPTION
// ============================================================================

/**
 * Create a membership subscription.
 * Routes to the appropriate provider (credit, token, stripe, wayforpay).
 * - Updates SSOT ledger using SubscriptionConductor (atomic).
 * 
 * // TODO: Migrate to React 19 Native useServerAction for type-inference in forms.
 */
export async function createSubscription(formData: FormData): Promise<SubscriptionResult> {
  try {
    // Require authentication to act on account
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    const provider = (formData.get('provider') as string) || 'credit_balance'
    // If 'auto_renew' not explicitly false, default to true (future: zod this)
    const autoRenew = formData.get('auto_renew') !== 'false'
    const memberTier = getMemberFiatTier()
    if (!memberTier)
      return { success: false, error: 'Member tier not configured' }

    // Dynamic SSR import for Subscription SSOT conductor
    const { SubscriptionConductor } = await import('@/lib/payments/subscription/subscription-conductor')
    const result = await SubscriptionConductor.createSubscription({
      userId: session.user.id,
      userEmail: session.user.email || '',
      provider: provider as 'credit_balance' | 'native_token' | 'stripe' | 'wayforpay',
      gateway: provider === 'credit_balance' ? 'Credit Balance' : getNativeTokenSymbol(),
      method: provider === 'credit_balance' ? 'credit_balance' as const : 'crypto' as const,
      amount: memberTier.amount,
      currency: provider === 'credit_balance' ? 'USD' : getNativeTokenSymbol(),
      gatewayFeePercent: 0,
      gatewayFeeFixed: 0,
      metadata: { auto_renew: autoRenew, target_role: 'MEMBER' },
    })

    if (!result.success)
      return { success: false, error: result.error || 'Failed to create subscription' }

    // Mutating: refresh wallet/profile on next request for fresh UI
    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: 'Subscription created successfully',
      subscription: result.subscriptionId
        ? {
            id: result.subscriptionId,
            status: 'active',
            provider,
            start_time: Date.now(),
            next_payment_due: Date.now() + 30 * 24 * 60 * 60 * 1000, // STUB: Renewal time is 30 days from now -- consider using real next cycle from provider
            auto_renew: autoRenew,
          }
        : { status: 'active', provider },
    }
  } catch (error) {
    logger.error('createSubscription failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription',
    }
  }
}

// ============================================================================
// 6. CANCEL SUBSCRIPTION
// ============================================================================

/**
 * Cancel the current active membership subscription.
 * - Delegates to SubscriptionConductor, which handles provider-specific logic.
 * 
 * // TODO: Refactor to give clearer UX on when cancel will take effect by returning effective cancel date.
 */
export async function cancelSubscription(formData: FormData): Promise<SubscriptionResult> {
  try {
    // Gate with authentication
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    // Immediate means terminate instantly, else cancel at end of period (future: let user select)
    const immediate = formData.get('immediate') === 'true'
    const reason = (formData.get('reason') as string) || 'User requested cancellation'

    const { SubscriptionConductor } = await import('@/lib/payments/subscription/subscription-conductor')

    // Lookup user subscription for provider reference
    const subscription = await SubscriptionConductor.getSubscription(session.user.id)
    if (!subscription)
      return { success: false, error: 'No active subscription found' }
    if (subscription.status !== 'active' && subscription.status !== 'pending')
      return { success: false, error: `Subscription is already ${subscription.status}` }

    // Extract gateway reference (PayPal needs paypal_subscription_id / I-…)
    let gatewayReference: string | undefined
    switch (subscription.provider) {
      case 'stripe':
        gatewayReference = subscription.stripe_subscription_id
        break
      case 'wayforpay':
        gatewayReference = subscription.wayforpay_rec_token
        break
      case 'native_token':
        gatewayReference = subscription.solana_tx_signature
        break
      case 'nft_gate':
        gatewayReference = subscription.nft_mint_address
        break
      case 'paypal':
        gatewayReference = subscription.paypal_subscription_id
        break
      default:
        gatewayReference = undefined
    }

    // Cancel actual subscription atomically in SSOT
    // STUB: Reason param is NOT forwarded -- optionally log to audit!
    const result = await SubscriptionConductor.cancelSubscription(
      session.user.id,
      subscription.provider,
      gatewayReference,
    )

    if (!result.success)
      return { success: false, error: result.error || 'Failed to cancel subscription' }

    // Invalidate data caches
    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription will cancel at end of billing period',
      subscription: {
        status: immediate ? 'cancelled' : 'active',
        provider: subscription.provider,
        next_payment_due: immediate ? undefined : subscription.next_payment_due,
      },
    }
  } catch (error) {
    logger.error('cancelSubscription failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription',
    }
  }
}

// ============================================================================
// 7. GET SUBSCRIPTION STATUS
// ============================================================================

/**
 * Get current subscription status for the authenticated user.
 * - Reads from single source of truth (SSOT) `subscription_ledger`.
 * - Also returns payment reminders & warnings as needed.
 *
 * // TODO: Use React Suspense for optimal server-form/instant UI updates
 */
export async function getSubscriptionStatus(): Promise<SubscriptionResult & {
  role?: string
  hasActiveMembership?: boolean
  daysUntilPayment?: number | null
  currentBalance?: string
  warnings?: Array<{ type: string; message: string }>
}> {
  try {
    // Require auth for status lookup
    const session = await auth()
    if (!session?.user?.id)
      return { success: false, error: 'Authentication required' }

    // SSR side-load for speed/concurrency
    const { SubscriptionConductor } = await import('@/lib/payments/subscription/subscription-conductor')
    const { creditBalanceService } = await import('@/features/wallet/services/credit-balance-service')

    // Parallelize DB calls: fetch both subscription and balance
    const [subscription, creditBalance] = await Promise.all([
      SubscriptionConductor.getSubscription(session.user.id),
      creditBalanceService.getUserCreditBalance(session.user.id),
    ])

    const hasActiveMembership =
      subscription
        ? subscription.status === 'active' || subscription.status === 'grace_period'
        : false

    // Compute days until next payment if relevant
    let daysUntilPayment: number | null = null
    const warnings: Array<{ type: string; message: string }> = []
    if (subscription && subscription.next_payment_due) {
      const timeDiff = subscription.next_payment_due - Date.now()
      daysUntilPayment = Math.ceil(timeDiff / (24 * 60 * 60 * 1000))
      // Proactive warnings for late or soon-to-due payments
      if (timeDiff < 0) {
        warnings.push({
          type: 'payment_overdue',
          message: `Payment is ${Math.abs(daysUntilPayment)} days overdue`
        })
      } else if (daysUntilPayment <= 3) {
        warnings.push({
          type: 'payment_reminder',
          message: `Payment due in ${daysUntilPayment} days`
        })
      }
    }

    return {
      success: true,
      role: session.user.role,
      hasActiveMembership,
      daysUntilPayment,
      currentBalance: creditBalance?.amount || '0',
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            provider: subscription.provider,
            gateway: subscription.gateway,
            start_time: subscription.start_time,
            next_payment_due: subscription.next_payment_due,
            auto_renew: subscription.auto_renew,
            total_paid: subscription.total_paid,
            payments_count: subscription.payments_count,
          }
        : { status: 'none' },
      // Only include warnings if any present (for cleaner API)
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    logger.error('getSubscriptionStatus failed', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get subscription status',
    }
  }
}
