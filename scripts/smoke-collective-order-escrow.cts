/**
 * Smoke stub — collective_order_slot PaymentPurpose + escrow service wiring.
 * Run manually after deploying PaymentConductor purpose env / webhooks.
 *
 * Expected:
 * - PaymentPurpose includes 'collective_order_slot'
 * - order ref prefix coslot_
 * - CollectiveOrderEscrowService.reserveSlot credit path increments slotsFilled
 */
export const SMOKE_COLLECTIVE_ORDER_ESCROW = {
  purpose: 'collective_order_slot' as const,
  orderReferencePrefix: 'coslot_',
  rails: ['credit', 'card', 'paypal'] as const,
  collection: 'collective_order_escrows',
}

console.log('[smoke-collective-order-escrow]', SMOKE_COLLECTIVE_ORDER_ESCROW)
