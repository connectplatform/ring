'use server'

/**
 * Membership Server Actions — Ring Platform
 *
 * Payment rails go through SubscriptionConductor (adapter SSOT).
 * Amounts derived from membership.ring × desk/oracle ratios (lib/membership/pricing).
 * Card processor: payment.cardPaymentProcessor (not CARD_PAYMENT_PROCESSOR).
 */

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { isPlatformAdmin } from '@/features/auth/user-role'
import { logger } from '@/lib/logger'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'
import { getMainCurrencySymbol } from '@/lib/ring-config-core'
import {
  getMemberMainCurrencyTier,
  getMembershipCreditAmountForPeriod,
  getMembershipMainCurrencyAmountForPeriod,
  getMembershipRingAmountForPeriod,
  getMembershipMainCurrencyPerNativeToken,
} from '@/lib/membership/pricing'
import { getCreditUnitLabel } from '@/lib/ring-oracle'
import {
  getCardPaymentProcessor,
  getGatewayConfig,
  isPaymentMethodEnabled,
} from '@/lib/payments/subscription/subscription-config'
import type { MembershipPaymentProvider } from '@/lib/ring-config-types'
import {
  cancelSubscriptionSchema,
  createSubscriptionSchema,
  parseMembershipForm,
  payWithCardSchema,
  payWithCreditBalanceSchema,
  payWithNativeTokenSchema,
} from '@/lib/zod/membership-schemas'

/**
 * Prefer `useActionState` + Zod-validated FormData for client forms.
 * There is no stable React `useServerAction` API — treat older TODOs as useActionState.
 */

export interface MembershipActionResult {
  success: boolean
  error?: string
  message?: string
}

export interface PricingResult extends MembershipActionResult {
  membershipFee?: string
  currency?: string
  mainCurrencyEquivalent?: string
  exchangeRate?: string
  paymentOptions?: Array<{
    type: string
    title: string
    description: string
    cost: { token_amount: string; main_currency_equivalent: string }
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

function gatewayFees(provider: MembershipPaymentProvider): {
  gatewayFeePercent: number
  gatewayFeeFixed: number
} {
  const gw = getGatewayConfig(provider)
  return {
    gatewayFeePercent: gw?.feePercent ?? 0,
    gatewayFeeFixed: gw?.feeFixedCents ?? 0,
  }
}

// ============================================================================
// 1. PAY WITH CREDIT BALANCE
// ============================================================================

/**
 * Pay membership via credit points (as set in ring-config).
 * Upgrade/renew routes through SubscriptionConductor.
 */
export async function payWithCreditBalance(formData: FormData): Promise<MembershipActionResult & {
  transactionId?: string
  newBalance?: string
  subscriptionStatus?: string
  autoSubscribed?: boolean
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const parsedForm = parseMembershipForm(payWithCreditBalanceSchema, formData)
    if (parsedForm.success === false) return { success: false, error: parsedForm.error }

    const userId = session.user.id
    const type = parsedForm.data.type
    const autoSubscribe = parsedForm.data.auto_subscribe !== false
    const period = parsedForm.data.period ?? parsedForm.data.billingPeriod ?? 'monthly'
    const creditFee = getMembershipCreditAmountForPeriod(period)
    const nativeTokenFee = getMembershipRingAmountForPeriod(period)
    const mainCurrencyFee = getMembershipMainCurrencyAmountForPeriod(period)
    const membershipFee = parsedForm.data.amount || String(creditFee)

    if (!isPaymentMethodEnabled('credit_balance')) {
      return { success: false, error: 'Credit balance payments are not enabled' }
    }

    const { creditBalanceService } = await import(
      '@/features/wallet/services/credit-balance-service'
    )
    const { getMainCurrencyCreditAccountingRate } = await import('@/lib/ring-oracle')
    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )

    const balance = await creditBalanceService.getUserCreditBalance(userId)
    if (!balance || parseFloat(balance.amount) < parseFloat(membershipFee)) {
      return {
        success: false,
        error: 'Insufficient credit balance',
        message: `Required: ${membershipFee} ${getCreditUnitLabel()}, Available: ${balance?.amount || '0'}. Please top up at /wallet/topup`,
      }
    }

    const fees = gatewayFees('credit_balance')
    let transactionId: string | undefined
    let newBalance: string | undefined
    let autoSubscribed = false

    switch (type) {
      case 'membership_upgrade': {
        // Single charge inside credit provider via Conductor (no pre-spend).
        const subResult = await SubscriptionConductor.createSubscription({
          userId,
          userEmail: session.user.email || '',
          provider: 'credit_balance',
          gateway: 'Credit Balance',
          method: 'credit_balance',
          amount: parseFloat(membershipFee),
          currency: getCreditUnitLabel(),
          ...fees,
          metadata: {
            auto_renew: autoSubscribe,
            target_role: 'member',
            billingPeriod: period,
            ringAmount: nativeTokenFee,
            mainCurrencyAmount: mainCurrencyFee,
            source: 'membership_action_credit',
          },
        })
        if (!subResult.success) {
          return {
            success: false,
            error: subResult.error || 'Credit membership upgrade failed',
          }
        }
        autoSubscribed = true
        transactionId = subResult.gatewayReference || subResult.subscriptionId
        const after = await creditBalanceService.getUserCreditBalance(userId)
        newBalance = after?.amount
        break
      }

      case 'subscription_renewal': {
        const renewResult = await SubscriptionConductor.renewSubscription(
          userId,
          'credit_balance',
        )
        if (!renewResult.success) {
          return {
            success: false,
            error: renewResult.error || 'Renewal failed',
          }
        }
        transactionId = renewResult.txSignature
        const after = await creditBalanceService.getUserCreditBalance(userId)
        newBalance = after?.amount
        break
      }

      case 'membership_fee': {
        const result = await creditBalanceService.processMembershipFee(
          userId,
          membershipFee,
          getMainCurrencyCreditAccountingRate(),
        )
        transactionId = result.transaction?.id
        const after = await creditBalanceService.getUserCreditBalance(userId)
        newBalance = after?.amount
        break
      }

      default:
        return { success: false, error: `Unsupported payment type: ${String(type)}` }
    }

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: `${String(type).replace(/_/g, ' ')} completed successfully`,
      transactionId,
      newBalance,
      autoSubscribed,
    }
  } catch (error) {
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
 * Pay membership with on-chain Native Token via SubscriptionConductor →
 * nativeTokenSubscriptionProvider (Membership program).
 * Do NOT transfer then create — that double-charges when metadata.tx_hash is missing.
 */
export async function payWithNativeToken(formData: FormData): Promise<MembershipActionResult & {
  txHash?: string
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const parsedForm = parseMembershipForm(payWithNativeTokenSchema, formData)
    if (parsedForm.success === false) return { success: false, error: parsedForm.error }

    const type = parsedForm.data.type
    const period = parsedForm.data.period ?? parsedForm.data.billingPeriod ?? 'monthly'
    const nativeTokenFee = getMembershipRingAmountForPeriod(period)
    const amount = parsedForm.data.amount || String(nativeTokenFee)

    if (!isPaymentMethodEnabled('native_token')) {
      return { success: false, error: 'Native token payments are not enabled' }
    }

    const parsed = parseFloat(amount)
    const maxRing = getMembershipRingAmountForPeriod('yearly') * 2
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maxRing) {
      return {
        success: false,
        error: `Invalid payment amount. Must be between 0.01 and ${maxRing} ${getNativeTokenSymbol()}`,
      }
    }

    const { getNativeTokenBalanceForUser } = await import(
      '@/features/wallet/chains/native-token-transfer-service'
    )
    const onChain = await getNativeTokenBalanceForUser(session.user.id)
    if (parseFloat(onChain.balance) < parsed) {
      return {
        success: false,
        error: `Insufficient native token balance. Required: ${amount} ${onChain.tokenSymbol}, Available: ${onChain.balance}`,
        message: `Please acquire more ${onChain.tokenSymbol} tokens via the desk widget on /wallet`,
      }
    }

    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )
    const tokenSymbol = getNativeTokenSymbol()
    const fees = gatewayFees('native_token')
    const autoRenew = parsedForm.data.auto_subscribe === true

    if (type === 'subscription_renewal') {
      const renew = await SubscriptionConductor.renewSubscription(
        session.user.id,
        'native_token',
      )
      if (!renew.success) {
        return { success: false, error: renew.error || 'Native token renewal failed' }
      }
      revalidatePath('/[locale]/wallet')
      revalidatePath('/[locale]/profile')
      return {
        success: true,
        message: `Native token renewal of ${amount} ${tokenSymbol} completed`,
        txHash: renew.txSignature,
      }
    }

    if (type === 'membership_fee') {
      // One-shot treasury transfer without subscription ledger (matches token API).
      const { transferNativeTokenForUser } = await import(
        '@/features/wallet/chains/native-token-transfer-service'
      )
      const { getNativeTokenTreasuryAddress } = await import('@/lib/ring-config-chain')
      const treasury = getNativeTokenTreasuryAddress()
      if (!treasury || treasury.length < 32) {
        return { success: false, error: 'Native token treasury is not configured' }
      }
      const transfer = await transferNativeTokenForUser({
        userId: session.user.id,
        toAddress: treasury,
        amount,
      })
      revalidatePath('/[locale]/wallet')
      revalidatePath('/[locale]/profile')
      return {
        success: true,
        message: `Native token payment of ${amount} ${tokenSymbol} completed`,
        txHash: transfer.txHash,
      }
    }

    // membership_upgrade (default): Conductor owns transfer + ledger + role.
    const result = await SubscriptionConductor.createSubscription({
      userId: session.user.id,
      userEmail: session.user.email || '',
      provider: 'native_token',
      gateway: tokenSymbol,
      method: 'crypto',
      amount: parsed,
      currency: tokenSymbol,
      ...fees,
      metadata: {
        auto_renew: autoRenew,
        target_role: 'member',
        billingPeriod: period,
        source: 'membership_action_native',
      },
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Native token membership upgrade failed',
      }
    }

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: `Native token payment of ${amount} ${tokenSymbol} completed`,
      txHash: result.txSignature || result.gatewayReference,
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
 * Card membership checkout via SubscriptionConductor.
 * Processor SSOT: payment.cardPaymentProcessor (env PAYMENT_MEMBERSHIP_PROCESSOR override).
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
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const parsedForm = parseMembershipForm(payWithCardSchema, formData)
    if (parsedForm.success === false) return { success: false, error: parsedForm.error }

    const period = parsedForm.data.period ?? parsedForm.data.billingPeriod ?? 'monthly'
    const memberTier = getMemberMainCurrencyTier()
    const fiatDefault = getMembershipMainCurrencyAmountForPeriod(period)
    const amount = parsedForm.data.amount || String(fiatDefault)
    const returnUrl = parsedForm.data.returnUrl || '/profile'

    const formProvider = parsedForm.data.provider
    const provider =
      formProvider === 'stripe' || formProvider === 'wayforpay'
        ? formProvider
        : getCardPaymentProcessor()

    if (!isPaymentMethodEnabled(provider)) {
      return {
        success: false,
        error: `${provider} is not currently supported. Please use credit balance or native token.`,
      }
    }

    const maxFiat = getMembershipMainCurrencyAmountForPeriod('yearly') * 2
    if (!isPlatformAdmin(session.user.role)) {
      const parsed = parseFloat(amount)
      if (isNaN(parsed) || parsed <= 0 || parsed > maxFiat) {
        return {
          success: false,
          error: `Invalid payment amount. Must be between 0.01 and ${maxFiat} ${memberTier.currency}`,
        }
      }
    }

    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )
    const gw = getGatewayConfig(provider)
    const fees = gatewayFees(provider)
    const currency = memberTier.currency || gw?.currency || getMainCurrencySymbol()

    const result = await SubscriptionConductor.createSubscription({
      userId: session.user.id,
      userEmail: session.user.email || '',
      provider,
      gateway: gw?.label || provider,
      method: 'card',
      amount: parseFloat(amount),
      currency,
      ...fees,
      returnUrl,
      metadata: {
        auto_renew: parsedForm.data.auto_subscribe === true,
        target_role: 'member',
        billingPeriod: period,
        source: 'membership_action_card',
      },
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || `${provider} payment initiation failed`,
      }
    }

    return {
      success: true,
      message: `Redirecting to ${provider} checkout`,
      paymentUrl: result.redirectUrl ?? result.redirect?.url,
      paymentFields: result.paymentFields ?? result.redirect?.fields,
      redirect: result.redirect,
      orderReference: result.subscriptionId || result.gatewayReference,
    }
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

export async function getMembershipPricing(): Promise<PricingResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const { creditBalanceService } = await import(
      '@/features/wallet/services/credit-balance-service'
    )
    const { getNativeTokenBalanceForUser } = await import(
      '@/features/wallet/chains/native-token-transfer-service'
    )

    const nativeTokenFee = getMembershipRingAmountForPeriod('monthly')
    const creditFee = getMembershipCreditAmountForPeriod('monthly')
    const mainCurrencyFee = getMembershipMainCurrencyAmountForPeriod('monthly')
    const mainCurrencyPerNativeToken = getMembershipMainCurrencyPerNativeToken()

    const creditBalance = await creditBalanceService.getUserCreditBalance(session.user.id)
    const currentBalance = parseFloat(creditBalance?.amount || '0')

    let nativeTokenBalance = '0'
    try {
      const onChain = await getNativeTokenBalanceForUser(session.user.id)
      nativeTokenBalance = onChain.balance
    } catch {
      // no wallet yet
    }

    const tokenSymbol = getNativeTokenSymbol()
    const mainCurrencyCost = mainCurrencyFee.toFixed(2)
    const paymentOptions = [
      {
        type: 'credit_balance',
        title: 'Credit Balance',
        description: `Pay with credit points (${creditFee} points = ${nativeTokenFee} ${tokenSymbol})`,
        cost: { token_amount: creditFee.toFixed(2), main_currency_equivalent: mainCurrencyCost },
        available:
          isPaymentMethodEnabled('credit_balance') && currentBalance >= creditFee,
        benefits: ['Instant processing', 'No additional fees'],
      },
      {
        type: 'native_token',
        title: `Pay with ${tokenSymbol}`,
        description: `Pay with your on-chain ${tokenSymbol} (treasury transfer / Membership)`,
        cost: { token_amount: nativeTokenFee.toFixed(2), main_currency_equivalent: mainCurrencyCost },
        available:
          isPaymentMethodEnabled('native_token') &&
          parseFloat(nativeTokenBalance) >= nativeTokenFee,
        benefits: ['Gas sponsored by treasury', 'No wallet popup required'],
      },
      {
        type: 'card',
        title: 'Credit/Debit Card',
        description: `Pay with Visa, Mastercard, or Apple Pay (${getCardPaymentProcessor()})`,
        cost: { token_amount: mainCurrencyFee.toFixed(2), main_currency_equivalent: mainCurrencyCost },
        available: isPaymentMethodEnabled(getCardPaymentProcessor()),
        benefits: ['Secure payment', 'Instant activation'],
      },
    ]

    return {
      success: true,
      membershipFee: nativeTokenFee.toFixed(2),
      currency: tokenSymbol,
      mainCurrencyEquivalent: mainCurrencyCost,
      exchangeRate: String(mainCurrencyPerNativeToken),
      paymentOptions,
      currentBalance: currentBalance.toFixed(2),
      balanceSufficient: currentBalance >= creditFee,
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

export async function createSubscription(formData: FormData): Promise<SubscriptionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const parsedForm = parseMembershipForm(createSubscriptionSchema, formData)
    if (parsedForm.success === false) return { success: false, error: parsedForm.error }

    const rawProvider = parsedForm.data.provider || 'credit_balance'
    const provider =
      rawProvider === 'ring_token' ? 'native_token' : (rawProvider as MembershipPaymentProvider)
    const autoRenew = parsedForm.data.auto_renew !== false
    const period = parsedForm.data.period ?? parsedForm.data.billingPeriod ?? 'monthly'
    const ringAmount = getMembershipRingAmountForPeriod(period)
    const creditAmount = getMembershipCreditAmountForPeriod(period)
    const mainCurrencyAmount = getMembershipMainCurrencyAmountForPeriod(period)
    const memberTier = getMemberMainCurrencyTier()

    const knownProviders = [
      'stripe',
      'wayforpay',
      'credit_balance',
      'native_token',
      'nft_gate',
      'paypal',
      'telegram_stars',
    ]
    if (!knownProviders.includes(provider)) {
      return { success: false, error: `Unsupported provider: ${provider}` }
    }

    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )
    const isCredit = provider === 'credit_balance'
    const isNative = provider === 'native_token'
    const fees = gatewayFees(provider)
    const gw = getGatewayConfig(provider)

    const result = await SubscriptionConductor.createSubscription({
      userId: session.user.id,
      userEmail: session.user.email || '',
      provider: provider as
        | 'credit_balance'
        | 'native_token'
        | 'stripe'
        | 'wayforpay'
        | 'paypal'
        | 'nft_gate'
        | 'telegram_stars',
      gateway: isCredit
        ? 'Credit Balance'
        : isNative
          ? getNativeTokenSymbol()
          : gw?.label || provider,
      method: isCredit
        ? ('credit_balance' as const)
        : isNative
          ? ('crypto' as const)
          : provider === 'paypal'
            ? ('paypal' as const)
            : ('card' as const),
      amount: isCredit ? creditAmount : isNative ? ringAmount : mainCurrencyAmount,
      currency: isCredit
        ? getCreditUnitLabel()
        : isNative
          ? getNativeTokenSymbol()
          : memberTier.currency,
      ...fees,
      metadata: {
        auto_renew: autoRenew,
        target_role: 'member',
        billingPeriod: period,
        ringAmount,
        mainCurrencyAmount,
        source: 'membership_action_create',
      },
    })

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create subscription' }
    }

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    const ledger = result.subscriptionId
      ? await SubscriptionConductor.getSubscription(session.user.id)
      : null

    return {
      success: true,
      message: 'Subscription created successfully',
      subscription: ledger
        ? {
            id: ledger.id,
            status: ledger.status,
            provider: ledger.provider,
            gateway: ledger.gateway,
            start_time: ledger.start_time,
            next_payment_due: ledger.next_payment_due,
            auto_renew: ledger.auto_renew,
            total_paid: ledger.total_paid,
            payments_count: ledger.payments_count,
          }
        : {
            id: result.subscriptionId,
            status: result.ledgerStatus || 'active',
            provider,
            auto_renew: autoRenew,
          },
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

export async function cancelSubscription(formData: FormData): Promise<SubscriptionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const parsedForm = parseMembershipForm(cancelSubscriptionSchema, formData)
    if (parsedForm.success === false) return { success: false, error: parsedForm.error }

    // Conductor cancels immediately at gateway + ledger; "end of period" is UX copy only until provider supports it.
    const immediate = parsedForm.data.immediate !== false
    const reason = parsedForm.data.reason || 'User requested cancellation'

    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )

    const subscription = await SubscriptionConductor.getSubscription(session.user.id)
    if (!subscription) return { success: false, error: 'No active subscription found' }
    if (subscription.status !== 'active' && subscription.status !== 'pending') {
      return { success: false, error: `Subscription is already ${subscription.status}` }
    }

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

    logger.info('cancelSubscription requested', {
      userId: session.user.id,
      provider: subscription.provider,
      immediate,
      reason,
    })

    const result = await SubscriptionConductor.cancelSubscription(
      session.user.id,
      subscription.provider,
      gatewayReference,
    )

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to cancel subscription' }
    }

    revalidatePath('/[locale]/wallet')
    revalidatePath('/[locale]/profile')

    return {
      success: true,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription cancelled (gateway cancel is immediate; end-of-period hold not yet provider-supported)',
      subscription: {
        status: 'cancelled',
        provider: subscription.provider,
        next_payment_due: undefined,
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

export async function getSubscriptionStatus(): Promise<SubscriptionResult & {
  role?: string
  hasActiveMembership?: boolean
  daysUntilPayment?: number | null
  currentBalance?: string
  warnings?: Array<{ type: string; message: string }>
}> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Authentication required' }

    const { SubscriptionConductor } = await import(
      '@/lib/payments/subscription/subscription-conductor'
    )
    const { creditBalanceService } = await import(
      '@/features/wallet/services/credit-balance-service'
    )

    const [subscription, creditBalance] = await Promise.all([
      SubscriptionConductor.getSubscription(session.user.id),
      creditBalanceService.getUserCreditBalance(session.user.id),
    ])

    const hasActiveMembership = subscription
      ? subscription.status === 'active' || subscription.status === 'grace_period'
      : false

    let daysUntilPayment: number | null = null
    const warnings: Array<{ type: string; message: string }> = []
    if (subscription && subscription.next_payment_due) {
      const timeDiff = subscription.next_payment_due - Date.now()
      daysUntilPayment = Math.ceil(timeDiff / (24 * 60 * 60 * 1000))
      if (timeDiff < 0) {
        warnings.push({
          type: 'payment_overdue',
          message: `Payment is ${Math.abs(daysUntilPayment)} days overdue`,
        })
      } else if (daysUntilPayment <= 3) {
        warnings.push({
          type: 'payment_reminder',
          message: `Payment due in ${daysUntilPayment} days`,
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
