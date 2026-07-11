import 'server-only'

import type { CreateCheckoutContext, CreateCheckoutResult } from '@/lib/payments/conductor/types'

/**
 * PayPal PaymentConductor processor — Phase S8 stub.
 * Wired into PaymentConductor so store/membership can select `paypal` via
 * PAYMENT_*_PROCESSOR=paypal without inventing a parallel checkout path.
 * Live PayPal Orders + webhooks land here when credentials ship.
 */
export async function createPayPalCheckout(
  _ctx: CreateCheckoutContext
): Promise<CreateCheckoutResult> {
  return {
    success: false,
    error:
      'PayPal payment processing is not yet implemented (Phase S8). Use WayForPay, Stripe, credit, or native token.',
    code: 'PAYPAL_NOT_IMPLEMENTED',
  }
}
