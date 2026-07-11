import crypto from 'crypto'
import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { getWebhookUrl } from '@/lib/payments/payment.config'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getMembershipTierConfig, initiatePayment } from '@/lib/payments/wayforpay-service'
import { initiateStorePayment } from '@/lib/payments/wayforpay-store-service'
import { UserRolesArray } from '@/features/auth/user-role'
import { getNativeTokenSymbol } from '@/lib/ring-config-chain'

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
  if (ctx.purpose === 'wallet_topup') {
    return createWalletTopupWayForPay(ctx)
  }
  if (ctx.purpose === 'native_token_onramp') {
    return createNativeTokenOnrampWayForPay(ctx)
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
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  const orderId = ctx.orderId ?? ctx.entityId
  const orderReference = buildOrderReference('store_order', { orderId })

  await paymentTransactionService.createPending({
    purpose: 'store_order',
    processor: 'wayforpay',
    rail: 'merchant_redirect',
    orderReference,
    entityType: 'store_order',
    entityId: orderId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100),
    currency: ctx.currency,
  })

  const result = await initiateStorePayment({
    orderId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    items: (ctx.items as any) || [],
    totalAmount: ctx.amount,
    currency: (ctx.currency as 'UAH' | 'USD' | 'EUR') || 'UAH',
    shippingInfo: (ctx.shippingInfo as any) || { email: ctx.userEmail },
    returnUrl: ctx.returnUrl,
    webhookUrl: getWebhookUrl('wayforpay'),
    locale: (ctx.locale as 'UK' | 'EN' | 'RU') || 'EN',
    orderReference,
  })

  if (result.success && result.paymentUrl) {
    await paymentTransactionService.markRedirected(orderReference)
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      orderReference,
    }
  }

  return { success: false, error: result.error ?? 'WayForPay initiation failed' }
}

/**
 * Handles checkout for membership upgrades via WayForPay.
 * @param ctx
 */
async function createMembershipWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(false)
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

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

  // Initiate payment with membership upgrade specifics (same orderReference as ledger row)
  const result = await initiatePayment({
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    targetRole,
    returnUrl: ctx.returnUrl,
    callbackUrl: getWebhookUrl('wayforpay'),
    orderReference,
  })

  // If the payment initiation succeeded
  if (result.success && result.paymentUrl) {
    await paymentTransactionService.markRedirected(orderReference)
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      orderReference,
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

/**
 * One-time WayForPay checkout for wallet credit top-up (points).
 */
async function createWalletTopupWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(false)
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  const amount = ctx.amount
  if (!Number.isFinite(amount) || amount < 25 || amount > 2000) {
    return { success: false, error: 'Amount must be between 25 and 2000' }
  }

  const currency = ctx.currency || 'USD'
  const orderReference = buildOrderReference('wallet_topup', { userId: ctx.userId })
  const orderDate = Math.floor(Date.now() / 1000)
  const productName = `Credit top-up ${amount} ${currency}`

  await paymentTransactionService.createPending({
    purpose: 'wallet_topup',
    processor: 'wayforpay',
    rail: 'merchant_redirect',
    orderReference,
    entityType: 'wallet_topup',
    entityId: ctx.userId,
    userId: ctx.userId,
    amountMinor: Math.round(amount * 100),
    currency,
  })

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
  const merchantSignature = crypto.createHmac('md5', secret).update(signString).digest('hex')

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

  await paymentTransactionService.markRedirected(orderReference)
  return { success: true, paymentUrl, orderReference }
}

/**
 * WayForPay checkout for confidential+ native token onramp (card → treasury RING).
 */
async function createNativeTokenOnrampWayForPay(
  ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(false)
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  const amount = ctx.amount
  if (!Number.isFinite(amount) || amount < 25 || amount > 2000) {
    return { success: false, error: 'Amount must be between 25 and 2000' }
  }

  const currency = ctx.currency || 'USD'
  const orderReference = buildOrderReference('native_token_onramp', { userId: ctx.userId })
  const orderDate = Math.floor(Date.now() / 1000)
  const symbol = getNativeTokenSymbol()
  const productName = `Native ${symbol} onramp ${amount} ${currency}`

  await paymentTransactionService.createPending({
    purpose: 'native_token_onramp',
    processor: 'wayforpay',
    rail: 'merchant_redirect',
    orderReference,
    entityType: 'native_token_onramp',
    entityId: ctx.userId,
    userId: ctx.userId,
    amountMinor: Math.round(amount * 100),
    currency,
  })

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
  const merchantSignature = crypto.createHmac('md5', secret).update(signString).digest('hex')

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

  await paymentTransactionService.markRedirected(orderReference)
  return { success: true, paymentUrl, orderReference }
}

// Export the helper for membership tiers (used elsewhere)
// TODO: If server actions used (Next.js 16+), consider using Edge config or /app/api route for more dynamic config
export { getMembershipTierConfig }
