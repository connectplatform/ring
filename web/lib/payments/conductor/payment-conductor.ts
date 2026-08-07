import type {
  CreateCheckoutContext,
  CreateCheckoutResult,
  PaymentProcessorId,
  WebhookHandleResult,
} from '@/lib/payments/conductor/types'
import { normalizeCheckoutResult } from '@/lib/payments/conductor/types'
import { getPaymentProvider } from '@/lib/payments/payment.config'
import { createWayForPayCheckout } from '@/lib/payments/processors/wayforpay.processor'
import { createStripeCheckout } from '@/lib/payments/processors/stripe.processor'
import { createCreditBalanceCheckout } from '@/lib/payments/processors/credit-balance.processor'
import { createNativeTokenCheckout } from '@/lib/payments/processors/native-token.processor'
import { createPayPalCheckout } from '@/lib/payments/processors/paypal.processor'
import {
  dispatchWayForPayWebhook,
  dispatchStripeWebhook,
  dispatchPayPalWebhook,
} from '@/lib/payments/conductor/webhook-dispatcher'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { assertNativeTokenOnrampAllowed } from '@/lib/payments/confidential-token-onramp'

/**
 * Rail → processor resolution. Internal rails settle as themselves; `paypal` is
 * both rail and processor; `card` defers to the metadata hint, then purpose config.
 */
function resolveProcessor(ctx: CreateCheckoutContext): PaymentProcessorId {
  if (ctx.rail === 'credit_balance') return 'credit_balance'
  if (ctx.rail === 'native_token') return 'native_token'
  if (ctx.rail === 'paypal') return 'paypal'

  const fromMeta = ctx.metadata?.processor
  if (fromMeta === 'paypal' || fromMeta === 'stripe' || fromMeta === 'wayforpay') {
    return fromMeta
  }
  return getPaymentProvider(ctx.purpose)
}

export const PaymentConductor = {
  async createCheckout(ctx: CreateCheckoutContext): Promise<CreateCheckoutResult> {
    if (ctx.purpose === 'native_token_onramp') {
      const denied = assertNativeTokenOnrampAllowed(ctx.metadata?.userRole)
      if (denied) return denied
    }

    const processor = resolveProcessor(ctx)

    let result: CreateCheckoutResult
    switch (processor) {
      case 'credit_balance':
        result = await createCreditBalanceCheckout(ctx)
        break
      case 'native_token':
        result = await createNativeTokenCheckout(ctx)
        break
      case 'paypal':
        result = await createPayPalCheckout(ctx)
        break
      case 'stripe':
        result = await createStripeCheckout(ctx)
        break
      case 'wayforpay':
      default:
        result = await createWayForPayCheckout(ctx)
        break
    }

    return normalizeCheckoutResult(result)
  },

  async handleWebhook(
    provider: 'wayforpay' | 'stripe' | 'paypal',
    request: Request
  ): Promise<WebhookHandleResult> {
    if (provider === 'stripe') {
      const rawBody = await request.text()
      const signature = request.headers.get('stripe-signature') ?? ''
      return dispatchStripeWebhook(rawBody, signature)
    }

    if (provider === 'paypal') {
      const rawBody = await request.text()
      return dispatchPayPalWebhook(rawBody, {
        transmissionId: request.headers.get('paypal-transmission-id') ?? '',
        transmissionTime: request.headers.get('paypal-transmission-time') ?? '',
        transmissionSig: request.headers.get('paypal-transmission-sig') ?? '',
        certUrl: request.headers.get('paypal-cert-url') ?? '',
        authAlgo: request.headers.get('paypal-auth-algo') ?? 'SHA256withRSA',
      })
    }

    const payload = (await request.json()) as Record<string, unknown>
    return dispatchWayForPayWebhook(payload)
  },

  getTransactionByReference(orderReference: string) {
    return paymentTransactionService.findByOrderReference(orderReference)
  },
}
