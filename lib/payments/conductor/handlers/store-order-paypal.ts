/**
 * PayPal store-order capture adapter.
 * Payload translation only — fulfillment lives in `fulfillStoreOrderPaid`.
 */

import { fulfillStoreOrderPaid } from '@/lib/payments/conductor/fulfill-store-order-paid'

export async function handleStorePayPalCapture(opts: {
  orderReference: string
  orderId: string
  amount: number
  currency: string
  processorPayload: Record<string, unknown>
}): Promise<{ success: boolean; orderId?: string }> {
  return fulfillStoreOrderPaid({
    orderId: opts.orderId,
    orderReference: opts.orderReference,
    amount: opts.amount,
    currency: opts.currency,
    rail: 'paypal',
    processor: 'paypal',
    processorPayload: opts.processorPayload,
    source: 'PayPal store',
  })
}
