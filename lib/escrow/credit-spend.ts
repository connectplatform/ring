import 'server-only'

import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { getMainCurrencyCreditAccountingRate } from '@/lib/ring-oracle'
import { ValidationError } from '@/lib/errors'

/**
 * Shared credit-rail helper for domain escrow services (task + collective order).
 * Spends credits immediately; caller owns ledger row + status transition.
 */
export async function spendCreditsForEscrow(params: {
  userId: string
  amount: number
  description: string
  referenceId: string
  metadata?: Record<string, unknown>
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId, amount, description, referenceId, metadata } = params
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Invalid escrow amount' }
  }

  try {
    await creditBalanceService.spendCredits(
      userId,
      {
        amount: String(amount),
        description,
        reference_id: referenceId,
        metadata: metadata ?? {},
      },
      'purchase',
      getMainCurrencyCreditAccountingRate(),
    )
    return { success: true }
  } catch (error) {
    const message =
      error instanceof ValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Credit spend failed'
    return { success: false, error: message }
  }
}
