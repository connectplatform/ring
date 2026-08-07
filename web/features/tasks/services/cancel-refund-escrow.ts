import 'server-only'

import { taskEscrowService } from '@/features/tasks/services/task-escrow-service'
import { logger } from '@/lib/logger'

/**
 * Cancel a held task escrow and refund (WFP / credit / native best-effort).
 */
export async function cancelAndRefundTaskEscrow(
  escrowId: string,
  adminUserId = 'system',
): Promise<{ success: boolean; error?: string }> {
  try {
    await taskEscrowService.adminResolve(escrowId, 'cancel', adminUserId)
    return { success: true }
  } catch (error) {
    logger.error('cancelAndRefundTaskEscrow failed', { escrowId, error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Refund failed',
    }
  }
}
