import type { ExternalPaymentProcessorId } from '@/lib/payments/conductor/types'

export type CollectiveOrderSlotPaymentStatus =
  | 'pending'
  | 'held'
  | 'released'
  | 'refunded'
  | 'failed'

export type CollectiveOrderSlotRail = 'credit_balance' | 'card' | 'paypal'

export interface CollectiveOrderEscrow {
  id: string
  opportunityId: string
  userId: string
  amount: number
  currency: string
  rail: CollectiveOrderSlotRail
  paymentStatus: CollectiveOrderSlotPaymentStatus
  orderReference?: string
  paymentTransactionId?: string
  refundReference?: string
  createdAt: string
  updatedAt: string
  heldAt?: string
  refundedAt?: string
}

export interface ReserveCollectiveOrderSlotInput {
  opportunityId: string
  userId: string
  userEmail: string
  rail: CollectiveOrderSlotRail
  returnUrl: string
  locale?: string
  processor?: ExternalPaymentProcessorId
}
