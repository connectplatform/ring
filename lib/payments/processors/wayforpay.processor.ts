import crypto from 'crypto'
import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { getWebhookUrl } from '@/lib/payments/payment.config'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getMembershipTierConfig, initiatePayment } from '@/lib/payments/wayforpay-service'
import { initiateStorePayment } from '@/lib/payments/wayforpay-store-service'
import { UserRolesArray } from '@/features/auth/user-role'

/**
 * Retrieves the credentials and domain information for WayForPay integration.
 * Will check store-specific environment variables if `useStore` is true.
 * @param useStore Whether to use store-specific credentials (default: false)
 * @returns Object containing merchant, secret, and domain
 */
function getWayForPayCredentials(useStore = false) {
  // Fallbacks are chained to ensure that main credentials are used if store vars are missing.
  const merchant = useStore
    ? process.env.WAYFORPAY_STORE_MERCHANT_ACCOUNT || process.env.WAYFORPAY_MERCHANT_ACCOUNT
    : process.env.WAYFORPAY_MERCHANT_ACCOUNT
  const secret = useStore
    ? process.env.WAYFORPAY_STORE_SECRET_KEY || process.env.WAYFORPAY_SECRET_KEY
    : process.env.WAYFORPAY_SECRET_KEY
  const domain = useStore
    ? process.env.WAYFORPAY_STORE_DOMAIN || process.env.WAYFORPAY_DOMAIN
    : process.env.WAYFORPAY_DOMAIN
  return { merchant, secret, domain }
}

/**
 * Entrypoint for WayForPay checkout.
 * Dispatches request based on ctx.purpose: can be store order, membership, or news.
 * Returns error for unsupported purposes.
 * @param ctx
 */
export async function createWayForPayCheckout(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  if (ctx.purpose === 'store_order') {
    return createStoreWayForPay(ctx)
  }
  if (ctx.purpose === 'membership_upgrade') {
    return createMembershipWayForPay(ctx)
  }
  if (ctx.purpose === 'news_promotion') {
    return createNewsWayForPay(ctx)
  }
  // Return error if the purpose is not recognized
  return { success: false, error: `WayForPay does not support purpose: ${ctx.purpose}` }
}

/**
 * Handles checkout for store order payments via WayForPay.
 * @param ctx
 */
async function createStoreWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(true)
  // Guard: configuration must be available
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  // Initiate payment with WayForPay store service
  const result = await initiateStorePayment({
    orderId: ctx.orderId ?? ctx.entityId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    items: (ctx.items as any) || [], // TODO: Strong type ctx.items throughout payment pipelines
    totalAmount: ctx.amount,
    currency: (ctx.currency as 'UAH' | 'USD' | 'EUR') || 'UAH',
    shippingInfo: (ctx.shippingInfo as any) || { email: ctx.userEmail }, // TODO: Validate/finalize shippingInfo type upstream
    returnUrl: ctx.returnUrl,
    webhookUrl: getWebhookUrl('wayforpay'),
    locale: (ctx.locale as 'UK' | 'EN' | 'RU') || 'EN',
  })

  // If the payment was initiated successfully
  if (result.success && result.paymentUrl) {
    // Prefer returned WayForPay orderId, but fallback to locally built
    const orderReference =
      result.wayforpayOrderId ?? buildOrderReference('store_order', { orderId: ctx.orderId ?? ctx.entityId })

    // Write a pending transaction to DB
    await paymentTransactionService.createPending({
      purpose: 'store_order',
      processor: 'wayforpay',
      rail: 'merchant_redirect',
      orderReference,
      entityType: 'store_order',
      entityId: ctx.orderId ?? ctx.entityId,
      userId: ctx.userId,
      amountMinor: Math.round(ctx.amount * 100),
      currency: ctx.currency,
    })

    // Mark transaction as user-redirected to merchant
    await paymentTransactionService.markRedirected(orderReference)

    // Return payment URL and order reference to client
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      orderReference,
    }
  }

  // Return error if initiation failed
  return { success: false, error: result.error ?? 'WayForPay initiation failed' }
}

/**
 * Handles checkout for membership upgrades via WayForPay.
 * @param ctx
 */
async function createMembershipWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  // Determine target membership role, fallback to member
  const targetRole = (ctx.targetRole as UserRolesArray) || UserRolesArray.member
  // Build reference for this upgrade
  const orderReference = buildOrderReference('membership_upgrade', { userId: ctx.userId })

  // Register a pending transaction (to be fulfilled on webhook)
  await paymentTransactionService.createPending({
    purpose: 'membership_upgrade',
    processor: 'wayforpay',
    rail: 'merchant_redirect',
    orderReference,
    entityType: 'membership_upgrade',
    entityId: ctx.userId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100),
    currency: ctx.currency,
  })

  // Initiate payment with membership upgrade specifics
  const result = await initiatePayment({
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    targetRole,
    returnUrl: ctx.returnUrl,
    callbackUrl: getWebhookUrl('wayforpay'),
  })

  // If the payment initiation succeeded
  if (result.success && result.paymentUrl) {
    // Mark transaction as redirected. Prefer WayForPay's returned orderId if possible.
    await paymentTransactionService.markRedirected(result.orderId ?? orderReference)
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      orderReference: result.orderId ?? orderReference,
    }
  }

  // Return error on failure
  return { success: false, error: result.error ?? 'WayForPay initiation failed' }
}

/**
 * Handles checkout for news article promotions via WayForPay.
 * Manual implementation due to absence of a dedicated service.
 * @param ctx
 */
async function createNewsWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(false)
  // Guard: Ensure credentials are available
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  const articleId = ctx.articleId ?? ctx.entityId
  // Create a unique reference for this news promotion
  const orderReference = buildOrderReference('news_promotion', { articleId })
  // Current Unix timestamp (seconds) for order date
  const orderDate = Math.floor(Date.now() / 1000)
  const amount = ctx.amount
  const currency = ctx.currency || 'UAH'
  // Define standardized product name for news promotions
  const productName = `Main page promotion ${articleId}`

  // Record the pending payment in DB
  await paymentTransactionService.createPending({
    purpose: 'news_promotion',
    processor: 'wayforpay',
    rail: 'merchant_redirect',
    orderReference,
    entityType: 'news_promotion',
    entityId: articleId,
    userId: ctx.userId,
    amountMinor: Math.round(amount * 100),
    currency,
  })

  // Construct concatenation string according to WayForPay signature requirements
  const signString = [
    merchant,
    domain,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    1,
    amount,
  ].join(';')

  // Generate HMAC-MD5 signature for payment
  const merchantSignature = crypto.createHmac('md5', secret).update(signString).digest('hex')

  // Assemble the payment URL to redirect user
  const paymentUrl =
    `https://secure.wayforpay.com/pay?merchantAccount=${encodeURIComponent(merchant)}` +
    `&merchantDomainName=${encodeURIComponent(domain)}` +
    `&orderReference=${encodeURIComponent(orderReference)}` +
    `&orderDate=${orderDate}` +
    `&amount=${amount}` +
    `&currency=${currency}` +
    `&productName=${encodeURIComponent(productName)}` +
    `&productCount=1` +
    `&productPrice=${amount}` +
    `&merchantSignature=${merchantSignature}` +
    `&returnUrl=${encodeURIComponent(ctx.returnUrl)}` +
    `&serviceUrl=${encodeURIComponent(getWebhookUrl('wayforpay'))}`

  // Mark news order as redirected in transaction service
  await paymentTransactionService.markRedirected(orderReference)

  // Return payment url and order reference to client
  return { success: true, paymentUrl, orderReference }
}

// Export the helper for membership tiers (used elsewhere)
// TODO: If server actions used (Next.js 16+), consider using Edge config or /app/api route for more dynamic config
export { getMembershipTierConfig }
