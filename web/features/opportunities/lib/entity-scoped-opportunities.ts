import 'server-only'

import { db } from '@/lib/database'
import { mapDbDocumentToOpportunity } from '@/features/opportunities/lib/opportunity-db-mapper'
import type { Opportunity } from '@/features/opportunities/types'

/** Staff inbox: entity-visibility opportunities addressed to these entities. */
export async function listEntityScopedOpportunities(
  entityIds: string[],
  filters?: { leadKind?: string; stage?: string },
): Promise<Opportunity[]> {
  const ids = [...new Set(entityIds.filter(Boolean))]
  if (ids.length === 0) return []

  const collected: Opportunity[] = []
  for (const organizationId of ids) {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'opportunities',
      filters: [
        { field: 'visibility', operator: '==', value: 'entity' },
        { field: 'organizationId', operator: '==', value: organizationId },
      ],
      pagination: { limit: 100 },
    })
    if (!result.success || !result.data) continue
    for (const row of result.data) {
      collected.push(mapDbDocumentToOpportunity(row))
    }
  }

  return collected.filter((opportunity) => {
    const meta = (opportunity.metadata || {}) as Record<string, unknown>
    if (filters?.leadKind && meta.leadKind !== filters.leadKind) return false
    if (filters?.stage && meta.stage !== filters.stage) return false
    return true
  })
}
