import type { TaskMetadata } from '@/features/chat/types'

export type TaskEscrowPaymentStatus =
  | 'none'
  | 'pending'
  | 'held'
  | 'released'
  | 'refunded'
  | 'failed'

export interface TaskEscrow {
  id: string
  reporterUserId: string
  assigneeUserId: string | null
  messageId: string
  conversationId: string
  amount: number
  currencyType: NonNullable<TaskMetadata['budget']>['currencyType']
  currencyCode?: string
  paymentStatus: TaskEscrowPaymentStatus
  orderReference?: string
  paymentTransactionId?: string
  /** Stable ledger ref stored on claim before money move (release). */
  releaseReference?: string
  /** Stable ledger ref stored on claim before money move (refund). */
  refundReference?: string
  createdAt: string
  updatedAt: string
  releasedAt?: string
  refundedAt?: string
}

export interface TaskEscrowFundInput {
  messageId: string
  conversationId: string
  reporterUserId: string
  assigneeUserId: string | null
  budget: NonNullable<TaskMetadata['budget']>
  escrowEnabled: boolean
}
