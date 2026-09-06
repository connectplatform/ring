import { cache } from 'react'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

export interface ViewerOpportunityInteractions {
  liked: Set<string>
  saved: Set<string>
  hidden: Set<string>
}

function emptyInteractions(): ViewerOpportunityInteractions {
  return { liked: new Set(), saved: new Set(), hidden: new Set() }
}

function rowTargetId(row: Record<string, unknown>): string {
  return String(row.targetId || row.target_id || '').trim()
}

/**
 * Opportunity ids the viewer marked not-interested (for pre-query exclusion).
 */
export const getViewerHiddenOpportunityIds = cache(async (userId: string): Promise<string[]> => {
  const id = String(userId || '').trim()
  if (!id) return []

  try {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'user_content_interactions',
      filters: [
        { field: 'userId', operator: '==', value: id },
        { field: 'targetType', operator: '==', value: 'opportunity' },
        { field: 'action', operator: '==', value: 'not_interested' },
      ],
    })
    if (!result.success || !result.data) return []
    return [...new Set(result.data.map(rowTargetId).filter(Boolean))]
  } catch (error) {
    logger.warn('getViewerHiddenOpportunityIds: query failed', {
      error: error instanceof Error ? error.message : error,
    })
    return []
  }
})

/**
 * Viewer's like / save / hide flags for a page of opportunity ids.
 */
export const getViewerOpportunityInteractions = cache(
  async (userId: string, opportunityIds: string[]): Promise<ViewerOpportunityInteractions> => {
    const viewerId = String(userId || '').trim()
    const ids = [...new Set(opportunityIds.map((id) => String(id || '').trim()).filter(Boolean))]
    if (!viewerId || ids.length === 0) return emptyInteractions()

    try {
      const [likesResult, interactionsResult] = await Promise.all([
        db().queryDocs<Record<string, unknown>>({
          collection: 'likes',
          filters: [
            { field: 'userId', operator: '==', value: viewerId },
            { field: 'targetType', operator: '==', value: 'opportunity' },
            { field: 'targetId', operator: 'in', value: ids },
          ],
        }),
        db().queryDocs<Record<string, unknown>>({
          collection: 'user_content_interactions',
          filters: [
            { field: 'userId', operator: '==', value: viewerId },
            { field: 'targetType', operator: '==', value: 'opportunity' },
            { field: 'targetId', operator: 'in', value: ids },
            { field: 'action', operator: 'in', value: ['save', 'not_interested'] },
          ],
        }),
      ])

      const liked = new Set(
        (likesResult.success && likesResult.data ? likesResult.data : [])
          .map(rowTargetId)
          .filter(Boolean),
      )
      const saved = new Set<string>()
      const hidden = new Set<string>()
      const interactionRows =
        interactionsResult.success && interactionsResult.data ? interactionsResult.data : []
      for (const row of interactionRows) {
        const targetId = rowTargetId(row)
        if (!targetId) continue
        if (row.action === 'save') saved.add(targetId)
        if (row.action === 'not_interested') hidden.add(targetId)
      }

      return { liked, saved, hidden }
    } catch (error) {
      logger.warn('getViewerOpportunityInteractions: query failed', {
        error: error instanceof Error ? error.message : error,
      })
      return emptyInteractions()
    }
  },
)
