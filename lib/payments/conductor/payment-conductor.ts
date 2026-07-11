import type {
  CreateCheckoutContext,
  CreateCheckoutResult,
  PaymentProcessorId,
} from '@/lib/payments/conductor/types'
import { getPaymentProvider } from '@/lib/payments/payment.config'
import { createWayForPayCheckout } from '@/lib/payments/processors/wayforpay.processor'
import { createStripeCheckout } from '@/lib/payments/processors/stripe.processor'
import { createInternalCreditCheckout } from '@/lib/payments/processors/internal-credit.processor'
import { createNativeTokenCheckout } from '@/lib/payments/processors/native-token.processor'
import { createPayPalCheckout } from '@/lib/payments/processors/paypal.processor'
import {
  dispatchWayForPayWebhook,
  dispatchStripeWebhook,
} from '@/lib/payments/conductor/webhook-dispatcher'
import type { WebhookHandleResult } from '@/lib/payments/conductor/types'
import { paymentTransactionService } from '@/lib/payments/payment-transaction-service'
import { assertNativeTokenOnrampAllowed } from '@/lib/payments/confidential-token-onramp'

function resolveProcessor(ctx: CreateCheckoutContext): PaymentProcessorId {
  if (ctx.rail === 'internal_credit') return 'internal-credit'
  if (ctx.rail === 'native_token') return 'native-token'
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

    switch (processor) {
      case 'internal-credit':
        return createInternalCreditCheckout(ctx)
      case 'native-token':
        return createNativeTokenCheckout(ctx)
      case 'paypal':
        return createPayPalCheckout(ctx)
      case 'stripe':
        return createStripeCheckout(ctx)
      case 'wayforpay':
      default:
        return createWayForPayCheckout(ctx)
    }
  },

  async handleWebhook(
    provider: 'wayforpay' | 'stripe',
    request: Request
  ): Promise<WebhookHandleResult> {
    if (provider === 'stripe') {
      const rawBody = await request.text()
      const signature = request.headers.get('stripe-signature') ?? ''
      return dispatchStripeWebhook(rawBody, signature)
    }

    const payload = (await request.json()) as Record<string, unknown>
    return dispatchWayForPayWebhook(payload)
  },

  getTransactionByReference(orderReference: string) {
    return paymentTransactionService.findByOrderReference(orderReference)
  },
}
