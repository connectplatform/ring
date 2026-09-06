import type { SerializedOpportunity } from '@/features/opportunities/types'
import { getOpportunityCreatorSummaries } from './get-opportunity-creators'
import { getViewerOpportunityInteractions } from './get-viewer-interactions'

function likeCount(opportunity: SerializedOpportunity): number {
  const raw = (opportunity as { likes?: unknown }).likes
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Attach creator snapshots and viewer interaction flags to a page of feed rows.
 */
export async function attachOpportunityFeedFields(
  opportunities: SerializedOpportunity[],
  viewerUserId?: string,
): Promise<SerializedOpportunity[]> {
  if (opportunities.length === 0) return opportunities

  const creatorIds = opportunities.map((row) => row.createdBy).filter(Boolean)
  const opportunityIds = opportunities.map((row) => row.id).filter(Boolean)

  const [creators, viewer] = await Promise.all([
    getOpportunityCreatorSummaries(creatorIds),
    viewerUserId
      ? getViewerOpportunityInteractions(viewerUserId, opportunityIds)
      : Promise.resolve(null),
  ])

  return opportunities.map((row) => ({
    ...row,
    likes: likeCount(row),
    creator: creators[row.createdBy],
    viewer: viewer
      ? {
          liked: viewer.liked.has(row.id),
          saved: viewer.saved.has(row.id),
          hidden: viewer.hidden.has(row.id),
        }
      : undefined,
  }))
}
