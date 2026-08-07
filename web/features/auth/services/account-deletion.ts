'use server'

import { logger } from '@/lib/logger'
import { db } from '@/lib/database'

type AccountDeletionStatus =
  | 'pending'
  | 'cancelled'
  | 'processing'
  | 'completed'
  | 'failed'

interface AccountDeletionRecord extends Record<string, unknown> {
  status: AccountDeletionStatus
  scheduledDeletionDate: Date | string
  canCancel?: boolean
  requestDate?: Date | string
  reason?: string
  cancelledDate?: Date | string
  processingStartDate?: Date | string
  completedDate?: Date | string
  failedDate?: Date | string
  failureReason?: string
}

interface AccountDeletionRequest {
  userId: string
  password: string
  reason: string
  userEmail: string
  userName: string
}

interface AccountDeletionCancel {
  userId: string
  userEmail: string
}

interface AccountDeletionConfirm {
  userId: string
  userEmail: string
  userName: string
}

interface AccountDeletionStatusCheck {
  userId: string
}

interface ServiceResult {
  success: boolean
  error?: string
  data?: any
}

/**
 * Request account deletion with grace period
 * Following GDPR "Right to be Forgotten" compliance
 */
export async function requestAccountDeletion(
  request: AccountDeletionRequest
): Promise<ServiceResult> {
  try {
    const { userId, password, reason, userEmail, userName } = request

    const userResult = await db().findDocById('users', userId)
    
    if (!userResult.success || !userResult.data) {
      return {
        success: false,
        error: 'ACCOUNT_NOT_FOUND'
      }
    }

    const existingDeletionResult = await db().findDocById<AccountDeletionRecord>('account_deletions', userId)
    
    if (existingDeletionResult.success && existingDeletionResult.data) {
      if (existingDeletionResult.data.status === 'pending') {
        return {
          success: false,
          error: 'DELETION_ALREADY_PENDING'
        }
      }
    }

    const deletionDate = new Date()
    deletionDate.setDate(deletionDate.getDate() + 30)

    const deletionData = {
      userId,
      userEmail,
      userName,
      requestDate: new Date(),
      scheduledDeletionDate: deletionDate,
      status: 'pending' as const,
      reason: reason || '',
      canCancel: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const createResult = await db().createDoc('account_deletions', deletionData, { id: userId })
    
    if (!createResult.success) {
      return {
        success: false,
        error: 'FAILED_TO_CREATE_DELETION_REQUEST'
      }
    }

    const updateResult = await db().updateDoc('users', userId, {
      accountStatus: 'deletion_pending',
      deletionRequestDate: new Date(),
      scheduledDeletionDate: deletionDate,
      updatedAt: new Date()
    })
    
    if (!updateResult.success) {
      return {
        success: false,
        error: 'FAILED_TO_UPDATE_USER_STATUS'
      }
    }

    logger.info('Account deletion requested', {
      userId,
      userEmail,
      scheduledDeletionDate: deletionDate,
      reason
    })

    return {
      success: true,
      data: {
        scheduledDeletionDate: deletionDate.toISOString()
      }
    }
    
  } catch (error) {
    logger.error('Account deletion request failed:', {
      userId: request.userId,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      success: false,
      error: 'INTERNAL_ERROR'
    }
  }
}

export async function cancelAccountDeletion(
  request: AccountDeletionCancel
): Promise<ServiceResult> {
  try {
    const { userId, userEmail } = request

    const deletionResult = await db().findDocById<AccountDeletionRecord>('account_deletions', userId)
    
    if (!deletionResult.success || !deletionResult.data) {
      return {
        success: false,
        error: 'NO_DELETION_PENDING'
      }
    }

    const deletionData = deletionResult.data

    if (deletionData.status !== 'pending') {
      return {
        success: false,
        error: 'NO_DELETION_PENDING'
      }
    }

    const scheduledDate = new Date(deletionData.scheduledDeletionDate)
    const now = new Date()
    
    if (now >= scheduledDate) {
      return {
        success: false,
        error: 'GRACE_PERIOD_EXPIRED'
      }
    }

    const updateDeletionResult = await db().updateDoc('account_deletions', userId, {
      status: 'cancelled',
      cancelledDate: new Date(),
      canCancel: false,
      updatedAt: new Date()
    })
    
    if (!updateDeletionResult.success) {
      return {
        success: false,
        error: 'FAILED_TO_CANCEL_DELETION'
      }
    }

    const updateUserResult = await db().updateDoc('users', userId, {
      accountStatus: 'active',
      deletionRequestDate: null,
      scheduledDeletionDate: null,
      updatedAt: new Date()
    })
    
    if (!updateUserResult.success) {
      return {
        success: false,
        error: 'FAILED_TO_RESTORE_USER_STATUS'
      }
    }

    logger.info('Account deletion cancelled', {
      userId,
      userEmail,
      cancelledDate: new Date()
    })

    return {
      success: true
    }
    
  } catch (error) {
    logger.error('Account deletion cancellation failed:', {
      userId: request.userId,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      success: false,
      error: 'INTERNAL_ERROR'
    }
  }
}

export async function confirmAccountDeletion(
  request: AccountDeletionConfirm
): Promise<ServiceResult> {
  try {
    const { userId, userEmail, userName } = request

    const deletionResult = await db().findDocById<AccountDeletionRecord>('account_deletions', userId)
    
    if (!deletionResult.success || !deletionResult.data) {
      return {
        success: false,
        error: 'NO_DELETION_PENDING'
      }
    }

    const deletionData = deletionResult.data

    if (deletionData.status !== 'pending') {
      return {
        success: false,
        error: 'NO_DELETION_PENDING'
      }
    }

    await db().updateDoc('account_deletions', userId, {
      status: 'processing',
      processingStartDate: new Date(),
      updatedAt: new Date()
    })

    const deleteUserResult = await db().updateDoc('users', userId, {
      accountStatus: 'deleted',
      deletedDate: new Date(),
      name: '[DELETED USER]',
      email: `deleted-${userId}@anonymized.local`,
      updatedAt: new Date()
    })
    
    if (!deleteUserResult.success) {
      return {
        success: false,
        error: 'FAILED_TO_DELETE_USER_DATA'
      }
    }

    await db().updateDoc('account_deletions', userId, {
      status: 'completed',
      completedDate: new Date(),
      updatedAt: new Date()
    })

    logger.info('Account deletion completed', {
      userId,
      originalEmail: userEmail,
      originalName: userName,
      deletedDate: new Date()
    })

    return {
      success: true
    }
    
  } catch (error) {
    logger.error('Account deletion confirmation failed:', {
      userId: request.userId,
      error: error instanceof Error ? error.message : error
    })
    
    try {
      await db().updateDoc('account_deletions', request.userId, {
        status: 'failed',
        failedDate: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date()
      })
    } catch (updateError) {
      logger.error('Failed to update deletion status after error:', updateError)
    }
    
    return {
      success: false,
      error: 'INTERNAL_ERROR'
    }
  }
}

export async function getAccountDeletionStatus(
  request: AccountDeletionStatusCheck
): Promise<ServiceResult> {
  try {
    const { userId } = request

    const deletionResult = await db().findDocById<AccountDeletionRecord>('account_deletions', userId)
    
    if (!deletionResult.success || !deletionResult.data) {
      return {
        success: true,
        data: {
          pendingDeletion: false
        }
      }
    }

    const deletionData = deletionResult.data

    return {
      success: true,
      data: {
        pendingDeletion: deletionData.status === 'pending',
        status: deletionData.status,
        requestDate: deletionData.requestDate,
        scheduledDeletionDate: deletionData.scheduledDeletionDate,
        canCancel: deletionData.canCancel && deletionData.status === 'pending',
        reason: deletionData.reason
      }
    }
    
  } catch (error) {
    logger.error('Account deletion status check failed:', {
      userId: request.userId,
      error: error instanceof Error ? error.message : error
    })
    
    return {
      success: false,
      error: 'INTERNAL_ERROR'
    }
  }
}

export async function processExpiredDeletions(): Promise<ServiceResult> {
  try {
    logger.info('Processing expired account deletions')
    
    return {
      success: true,
      data: {
        processed: 0,
        failed: 0
      }
    }
    
  } catch (error) {
    logger.error('Batch deletion processing failed:', error)
    
    return {
      success: false,
      error: 'INTERNAL_ERROR'
    }
  }
}
