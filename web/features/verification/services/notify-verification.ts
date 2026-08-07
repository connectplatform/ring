import 'server-only'

import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { publishToChannel } from '@/lib/tunnel/publisher'
import type { VerificationSubjectType } from '@/features/verification/types/verification-procedure'

export type VerificationNotifyType =
  | 'verification.submitted'
  | 'verification.under_review'
  | 'verification.approved'
  | 'verification.rejected'

export interface VerificationNotifyInput {
  type: VerificationNotifyType
  procedureNumber: string
  subjectType: VerificationSubjectType
  subjectId: string
  applicantUserId: string
  entityName?: string
  rejectionReason?: string
}

export async function notifyVerificationEvent(input: VerificationNotifyInput): Promise<void> {
  const event = {
    ...input,
    createdAt: new Date().toISOString(),
  }

  try {
    await db().createDoc('matcher_verification_events', event)
  } catch (error) {
    logger.warn('notify-verification: failed to persist event', { error, event })
  }

  try {
    await publishToChannel('matcher:verification', input.type, event)
  } catch (error) {
    logger.warn('notify-verification: tunnel publish skipped', { error, event })
  }
}
