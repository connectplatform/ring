import 'server-only'

import type { SerializedOpportunity } from '@/features/opportunities/types'
import type { MatchingResult } from '@/features/opportunities/services/matching-service'
import { getResolvedAIConfig } from '@/features/admin/platform-settings/resolved-ai-config'
import { isLLMAvailableAsync } from '@/lib/ai/llm-client'
import { getMatcherInstallDefaults } from '@/lib/ring-config-core'
import { appendEvent } from '@/lib/events/event-log.server'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import { syncOpportunityDiscovery } from '@/features/opportunities/lib/opportunity-mutation-sync'

export type AutoApprovalResult = {
  approved: boolean
  reason: string
}

export async function maybeAutoApproveOpportunity(
  opportunity: SerializedOpportunity,
  matchingResult: MatchingResult,
): Promise<AutoApprovalResult> {
  try {
    const aiConfig = await getResolvedAIConfig()
    if (!aiConfig.matcher.autoApprove) {
      return { approved: false, reason: 'auto_approve_disabled' }
    }

    if (opportunity.status !== 'pending') {
      return { approved: false, reason: 'not_pending' }
    }

    if (!(await isLLMAvailableAsync())) {
      return { approved: false, reason: 'llm_unavailable' }
    }

    const llmConfidenceGate = getMatcherInstallDefaults().llmConfidenceGate
    const bestConfidence = matchingResult.matches.reduce(
      (max, match) => Math.max(max, match.confidence ?? 0),
      0,
    )
    if (bestConfidence < llmConfidenceGate) {
      return {
        approved: false,
        reason: `llm_not_used_for_run (best confidence ${bestConfidence} < ${llmConfidenceGate})`,
      }
    }

    const minScore = aiConfig.matcher.autoApproveMinScore * 100
    const qualifying = matchingResult.matches.filter((m) => m.overallScore >= minScore)
    if (qualifying.length === 0) {
      return { approved: false, reason: `no_matches_above_threshold (${minScore})` }
    }

    const topScore = Math.max(...qualifying.map((m) => m.overallScore))
    const now = new Date()

    const updateResult = await db().updateDoc(
      'opportunities',
      opportunity.id,
      {
        status: 'active',
        dateUpdated: now,
      },
      { merge: true },
    )

    if (!updateResult.success) {
      logger.warn('AutoApproval: failed to update opportunity status', {
        opportunityId: opportunity.id,
        error: updateResult.error,
      })
      return { approved: false, reason: 'db_update_failed' }
    }

    await appendEvent({
      type: 'opportunity_auto_approved',
      userId: opportunity.createdBy,
      reversible: false,
      payload: {
        opportunityId: opportunity.id,
        topScore,
        matchCount: qualifying.length,
        threshold: minScore,
        bestConfidence,
      },
    })

    await syncOpportunityDiscovery({
      opportunityId: opportunity.id,
      event: 'status_changed',
    })

    await notifyCreatorAutoApproved(opportunity)

    logger.info('AutoApproval: opportunity promoted to active', {
      opportunityId: opportunity.id,
      topScore,
      matchCount: qualifying.length,
    })

    return { approved: true, reason: 'approved' }
  } catch (error) {
    logger.error('AutoApproval: internal error', { error, opportunityId: opportunity.id })
    return { approved: false, reason: 'internal_error' }
  }
}

async function notifyCreatorAutoApproved(opportunity: SerializedOpportunity): Promise<void> {
  try {
    const { createNotification } = await import(
      '@/features/notifications/services/notification-service'
    )
    const { NotificationType, NotificationChannel, NotificationPriority } = await import(
      '@/features/notifications/types'
    )

    await createNotification({
      userId: opportunity.createdBy,
      type: NotificationType.OPPORTUNITY_UPDATED,
      priority: NotificationPriority.HIGH,
      title: 'Opportunity auto-approved',
      body: 'Your opportunity was auto-approved and is now live.',
      actionText: 'View opportunity',
      actionUrl: `/opportunities/${opportunity.id}`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      data: {
        opportunityId: opportunity.id,
        autoApproved: true,
      },
    } as never)
  } catch (error) {
    logger.warn('AutoApproval: creator notification failed', {
      opportunityId: opportunity.id,
      error,
    })
  }
}
