/**
 * POST /api/store/payments/card
 * Alias for WayForPay/Stripe PaymentConductor card checkout (card rail).
 * Processor resolved by getPaymentProvider('store_order') inside the wayforpay route
 * unless a dedicated stripe route forces metadata.processor.
 */
export { POST, GET } from '../wayforpay/route'
