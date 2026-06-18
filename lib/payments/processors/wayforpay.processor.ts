import crypto from 'crypto'
import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { getWebhookUrl } from '@/lib/payments/payment.config'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { getMembershipTierConfig, initiatePayment } from '@/lib/payments/wayforpay-service'
import { initiateStorePayment } from '@/lib/payments/wayforpay-store-service'
import { UserRole } from '@/features/auth/types'

function getWayForPayCredentials(useStore = false) {
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
  return { success: false, error: `WayForPay does not support purpose: ${ctx.purpose}` }
}

async function createStoreWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(true)
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  const result = await initiateStorePayment({
    orderId: ctx.orderId ?? ctx.entityId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    items: (ctx.items as any) || [],
    totalAmount: ctx.amount,
    currency: (ctx.currency as 'UAH' | 'USD' | 'EUR') || 'UAH',
    shippingInfo: (ctx.shippingInfo as any) || { email: ctx.userEmail },
    returnUrl: ctx.returnUrl,
    webhookUrl: getWebhookUrl('wayforpay'),
    locale: (ctx.locale as 'UK' | 'EN' | 'RU') || 'EN',
  })

  if (result.success && result.paymentUrl) {
    const orderReference = result.wayforpayOrderId ?? buildOrderReference('store_order', { orderId: ctx.orderId ?? ctx.entityId })
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
    await paymentTransactionService.markRedirected(orderReference)
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      orderReference,
    }
  }
  return { success: false, error: result.error ?? 'WayForPay initiation failed' }
}

async function createMembershipWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const targetRole = (ctx.targetRole as UserRole) || UserRole.member
  const orderReference = buildOrderReference('membership_upgrade', { userId: ctx.userId })

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

  const result = await initiatePayment({
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    targetRole,
    returnUrl: ctx.returnUrl,
    callbackUrl: getWebhookUrl('wayforpay'),
  })

  if (result.success && result.paymentUrl) {
    await paymentTransactionService.markRedirected(result.orderId ?? orderReference)
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      orderReference: result.orderId ?? orderReference,
    }
  }
  return { success: false, error: result.error ?? 'WayForPay initiation failed' }
}

async function createNewsWayForPay(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
  const { merchant, secret, domain } = getWayForPayCredentials(false)
  if (!merchant || !secret || !domain) {
    return { success: false, error: 'WayForPay not configured' }
  }

  const articleId = ctx.articleId ?? ctx.entityId
  const orderReference = buildOrderReference('news_promotion', { articleId })
  const orderDate = Math.floor(Date.now() / 1000)
  const amount = ctx.amount
  const currency = ctx.currency || 'UAH'
  const productName = `Main page promotion ${articleId}`

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

  const paymentUrl = `https://secure.wayforpay.com/pay?merchantAccount=${encodeURIComponent(merchant)}&merchantDomainName=${encodeURIComponent(domain)}&orderReference=${encodeURIComponent(orderReference)}&orderDate=${orderDate}&amount=${amount}&currency=${currency}&productName=${encodeURIComponent(productName)}&productCount=1&productPrice=${amount}&merchantSignature=${merchantSignature}&returnUrl=${encodeURIComponent(ctx.returnUrl)}&serviceUrl=${encodeURIComponent(getWebhookUrl('wayforpay'))}`

  await paymentTransactionService.markRedirected(orderReference)

  return { success: true, paymentUrl, orderReference }
}

export { getMembershipTierConfig }
