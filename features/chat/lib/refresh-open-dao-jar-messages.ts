/**
 * TD-UX-05 — After public-pool totals change, refresh all open dao_jar chat snapshots.
 * Domain owns money; chat owns the bubble metadata snapshot.
 */
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'
import type { DaoJarMetadata, Message } from '@/features/chat/types'
import type { PublicPoolDoc } from '@/lib/zod/public-pool-schemas'

const MAX_JAR_MESSAGES = 100

function poolToJarSnapshot(pool: PublicPoolDoc): Pick<
  DaoJarMetadata,
  'kind' | 'poolId' | 'poolSlug' | 'title' | 'goalRing' | 'pledgedRing' | 'fundingMode' | 'status'
> {
  return {
    kind: 'dao_jar',
    poolId: pool.id,
    poolSlug: pool.pool_slug,
    title: pool.title,
    goalRing: pool.goal_native_token,
    pledgedRing: pool.pledged_native_token,
    fundingMode: pool.funding_mode === 'escrow' ? 'escrow' : 'donation',
    status: pool.status,
  }
}

export type RefreshDaoJarOptions = {
  contributorUserId?: string
  lastContribution?: DaoJarMetadata['lastContribution']
}

/**
 * Find dao_jar messages for a poolSlug and push fresh pledged/status via MessageService.updateMessage
 * (tunnel `message:update`).
 */
export async function refreshOpenDaoJarMessages(
  poolSlug: string,
  opts?: RefreshDaoJarOptions,
): Promise<number> {
  const slug = String(poolSlug || '').trim()
  if (!slug) return 0

  try {
    const { getPublicPoolConfig } = await import('@/lib/ring-config-core')
    const { findPoolBySlug } = await import('@/features/public-pools/lib/public-pool-db')
    const { MessageService } = await import('@/features/chat/services/message-service')

    const { cloneId } = getPublicPoolConfig()
    const pool = await findPoolBySlug(cloneId, slug)
    if (!pool) {
      logger.warn('refreshOpenDaoJarMessages: pool not found', { poolSlug: slug })
      return 0
    }

    const result = await db().queryDocs<Message>({
      collection: 'messages',
      filters: [
        { field: 'type', operator: '==', value: 'dao_jar' },
        {
          field: 'metadata',
          operator: 'jsonb-contains',
          value: { kind: 'dao_jar', poolSlug: slug },
        },
      ],
      pagination: { limit: MAX_JAR_MESSAGES },
    })

    if (!result.success || !result.data?.length) return 0

    const messages = new MessageService()
    const snapshot = poolToJarSnapshot(pool)
    let updatedCount = 0

    for (const msg of result.data) {
      const prev = (msg.metadata ?? {}) as unknown as DaoJarMetadata
      if (prev.kind && prev.kind !== 'dao_jar') continue

      const contributorUserIds = Array.from(
        new Set([
          ...(prev.contributorUserIds ?? []),
          ...(opts?.contributorUserId ? [opts.contributorUserId] : []),
        ]),
      )

      const nextMeta: DaoJarMetadata = {
        ...prev,
        ...snapshot,
        contributorUserIds: contributorUserIds.length ? contributorUserIds : prev.contributorUserIds,
        lastContribution: opts?.lastContribution ?? prev.lastContribution,
      }

      await messages.updateMessage(msg.id, {
        metadata: nextMeta as unknown as Record<string, unknown>,
      })
      updatedCount += 1
    }

    return updatedCount
  } catch (error) {
    logger.error('refreshOpenDaoJarMessages failed', {
      poolSlug: slug,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}
