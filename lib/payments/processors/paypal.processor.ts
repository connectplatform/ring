import 'server-only'

import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'
import { navigateCheckoutRedirect } from '@/lib/payments/conductor/types'
import { buildOrderReference } from '@/lib/payments/order-reference'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import {
  extractPayPalApproveUrl,
  formatPayPalAmountValue,
  getPayPalGatewayCurrency,
  isPayPalCredentialsConfigured,
  isPayPalGatewayEnabled,
  paypalApiFetch,
  type PayPalLink,
} from '@/lib/payments/processors/paypal-client'
import { logger } from '@/lib/logger'

function productNameForPurpose(ctx: CreateCheckoutContext): string {
  switch (ctx.purpose) {
    case 'news_promotion':
      return 'News main-page promotion'
    case 'store_order':
      return 'Store order'
    case 'membership_upgrade':
      return 'Membership upgrade'
    case 'wallet_topup':
      return 'Wallet credit top-up'
    case 'native_token_onramp':
      return 'Native token onramp (unsupported via PayPal)'
    default:
      return 'Ring payment'
  }
}

/**
 * PayPal PaymentConductor processor — Orders v2 CAPTURE (merchant_redirect).
 * Fulfillment is webhook-driven (PAYMENT.CAPTURE.COMPLETED); never trust return URL alone.
 */
export async function createPayPalCheckout(
  ctx: CreateCheckoutContext,
): Promise<CreateCheckoutResult> {
  if (ctx.purpose === 'native_token_onramp') {
    return {
      success: false,
      error: 'PayPal does not support native_token_onramp — use card onramp or Token Desk',
      code: 'PAYPAL_ONRAMP_UNSUPPORTED',
    }
  }

  if (!isPayPalCredentialsConfigured()) {
    return { success: false, error: 'PayPal not configured', code: 'PAYPAL_NOT_CONFIGURED' }
  }

  // Allow membership/wallet routes to probe credentials even when gateway.enabled is still false
  // in ring-config (ops enable after sandbox smoke). Store UI separately gates on NEXT_PUBLIC flag.
  if (ctx.purpose === 'store_order' && !isPayPalGatewayEnabled()) {
    return {
      success: false,
      error: 'PayPal store payments are disabled (payment.gateways.paypal.enabled)',
      code: 'PAYPAL_GATEWAY_DISABLED',
    }
  }

  const orderReference = buildOrderReference(ctx.purpose, {
    orderId: ctx.orderId ?? ctx.entityId,
    userId: ctx.userId,
    articleId: ctx.articleId ?? ctx.entityId,
  })

  const currency = (ctx.currency || getPayPalGatewayCurrency()).toUpperCase()
  const value = formatPayPalAmountValue(ctx.amount)

  await paymentTransactionService.createPending({
    purpose: ctx.purpose,
    processor: 'paypal',
    rail: 'merchant_redirect',
    orderReference,
    entityType: ctx.purpose,
    entityId: ctx.entityId,
    userId: ctx.userId,
    amountMinor: Math.round(ctx.amount * 100),
    currency: currency.toLowerCase(),
  })

  try {
    const returnUrl = ctx.returnUrl || ''
    const cancelUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || ''}/`

    const order = await paypalApiFetch<{
      id?: string
      status?: string
      links?: PayPalLink[]
    }>('/v2/checkout/orders', {
      method: 'POST',
      idempotencyKey: orderReference,
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderReference.slice(0, 256),
            custom_id: orderReference,
            description: productNameForPurpose(ctx).slice(0, 127),
            amount: {
              currency_code: currency,
              value,
            },
          },
        ],
        application_context: {
          brand_name: 'Ring Platform',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    })

    const paymentUrl = extractPayPalApproveUrl(order.links)
    if (!paymentUrl) {
      logger.error('PayPal create order: missing approve link', { orderReference, order })
      return { success: false, error: 'PayPal approve URL missing', orderReference }
    }

    await paymentTransactionService.markRedirected(orderReference)

    return {
      success: true,
      paymentUrl,
      redirect: navigateCheckoutRedirect(paymentUrl),
      orderReference,
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'PayPal error'
    logger.error('PayPal createPayPalCheckout failed', { orderReference, message })
    return { success: false, error: message, orderReference }
  }
}
