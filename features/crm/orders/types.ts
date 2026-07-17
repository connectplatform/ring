import type { CalculatorInputs, CalculatorResults } from '@/features/calculator/types'

export type ProjectPaymentStatus =
  | 'draft'
  | 'pending_payment'
  | 'paid'
  | 'refunded'
  | 'failed'

export type ProjectWorkStatus =
  | 'new'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'disputed'
  | 'canceled'

export interface ProjectOrderSnapshot {
  inputs: CalculatorInputs
  results: Pick<
    CalculatorResults,
    | 'oneTimePoints'
    | 'monthlyPoints'
    | 'oneTimeFiat'
    | 'monthlyFiat'
    | 'oneTimeNative'
    | 'monthlyNative'
    | 'complexity'
    | 'customizationComplexity'
    | 'estimatedHours'
    | 'recommendedConfig'
  >
  rates: CalculatorResults['rates']
}

export interface ProjectOrder {
  id: string
  userId: string
  paymentStatus: ProjectPaymentStatus
  workStatus: ProjectWorkStatus
  progress: number
  integratorId: string | null
  requestorIds: string[]
  opportunityId: string | null
  details: string
  snapshot: ProjectOrderSnapshot
  amount: number
  currency: string
  orderReference: string | null
  paymentTransactionId: string | null
  refundReference: string | null
  refundedAt: string | null
  createdAt: string
  updatedAt: string
}

export const PROJECT_WORK_STATUSES: ProjectWorkStatus[] = [
  'new',
  'available',
  'in_progress',
  'completed',
  'disputed',
  'canceled',
]
