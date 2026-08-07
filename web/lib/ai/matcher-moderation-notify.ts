import 'server-only'

import { publishToChannel } from '@/lib/tunnel/publisher'
import { logger } from '@/lib/logger'
import { db } from '@/lib/database'
import type {
  EntityReportCategory,
  MatcherModerationEvent,
} from '@/features/entities/lib/entity-moderation-types'

export type MatcherModerationNotifyInput = {
  type: MatcherModerationEvent['type']
  entityId: string
  actorUserId: string
  category?: EntityReportCategory
  reason?: string
  entityName?: string
}

async function summarizeReportWithLlm(input: {
  entityName?: string
  category?: EntityReportCategory
  reason?: string
}): Promise<string | undefined> {
  try {
    const { createLLMClientAsync, isLLMAvailableAsync } = await import('@/lib/ai/llm-client')
    if (!(await isLLMAvailableAsync())) return undefined

    const client = await createLLMClientAsync()
    const prompt = `Summarize this entity moderation report in one sentence for an admin queue.
Entity: ${input.entityName ?? 'unknown'}
Category: ${input.category ?? 'other'}
Reporter reason: ${input.reason ?? '(none)'}`

    const response = await client.complete(prompt, {
      maxTokens: 120,
      temperature: 0.2,
    })

    const text = response.content?.trim()
    return text || undefined
  } catch (error) {
    logger.warn('matcher-moderation-notify: LLM summary skipped', { error })
    return undefined
  }
}

/**
 * Persist moderation signal and fan-out to matcher admin consumers (Tunnel + JSONB queue).
 */
export async function notifyMatcherEntityModeration(
  input: MatcherModerationNotifyInput,
): Promise<void> {
  const summary =
    input.type === 'entity_reported'
      ? await summarizeReportWithLlm({
          entityName: input.entityName,
          category: input.category,
          reason: input.reason,
        })
      : undefined

  const event: MatcherModerationEvent = {
    type: input.type,
    entityId: input.entityId,
    actorUserId: input.actorUserId,
    category: input.category,
    reason: input.reason,
    summary,
    createdAt: new Date().toISOString(),
  }

  try {
    await db().createDoc('matcher_moderation_events', event)
  } catch (error) {
    logger.warn('matcher-moderation-notify: failed to persist event', { error, event })
  }

  try {
    const tunnelEvent = input.type.replace(/_/g, ':')
    await publishToChannel('matcher', tunnelEvent, event)
  } catch (error) {
    logger.warn('matcher-moderation-notify: tunnel publish failed', { error, event })
  }

  logger.info('matcher-moderation-notify: dispatched', {
    type: input.type,
    entityId: input.entityId,
    actorUserId: input.actorUserId,
    hasSummary: !!summary,
  })
}
