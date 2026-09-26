import { db } from '@/lib/database'
import { buildOpportunityVisibilityFilters, type DbFilter } from '@/features/opportunities/lib/opportunity-visibility-filter'
import type { OpportunityListQuery } from '@/features/opportunities/lib/opportunity-search-params'

export type OpportunityListFilterInput = OpportunityListQuery & {
  userRole: string | null | undefined
  hiddenIds?: string[]
}

function ilikeContains(raw: string): string {
  const trimmed = raw.trim().replace(/[%_]/g, '')
  return `%${trimmed}%`
}

function deadlineCutoff(window: string): Date | null {
  const now = new Date()
  switch (window) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    case 'week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    default:
      return null
  }
}

/**
 * Shared WHERE builder for browse list + search (role visibility, rail filters).
 * Does not include pagination cursor — apply `applyOpportunityDateCursor` after.
 */
export function buildOpportunityListFilters(input: OpportunityListFilterInput): DbFilter[] {
  const filters: DbFilter[] = [...buildOpportunityVisibilityFilters(input.userRole)]

  if (input.hiddenIds && input.hiddenIds.length > 0) {
    filters.push({ field: 'id', operator: 'not-in', value: input.hiddenIds })
  }

  if (input.query && input.query.trim()) {
    filters.push({ field: 'title', operator: 'ilike', value: ilikeContains(input.query) })
  }

  if (input.types && input.types.length > 0) {
    filters.push({ field: 'type', operator: 'in', value: input.types })
  }

  if (input.categories && input.categories.length > 0) {
    filters.push({ field: 'category', operator: 'in', value: input.categories })
  }

  if (input.location && input.location.trim()) {
    const loc = input.location.trim().toLowerCase()
    filters.push({ field: 'location', operator: '>=', value: loc })
    filters.push({ field: 'location', operator: '<=', value: loc + '\uf8ff' })
  }

  if (input.budgetMin !== undefined) {
    filters.push({ field: 'budget.min', operator: '>=', value: input.budgetMin })
  }
  if (input.budgetMax !== undefined) {
    filters.push({ field: 'budget.max', operator: '<=', value: input.budgetMax })
  }
  if (input.currency) {
    filters.push({ field: 'budget.currency', operator: '==', value: input.currency })
  }

  if (input.priority && input.priority !== 'all' && input.priority !== 'any') {
    filters.push({ field: 'priority', operator: '==', value: input.priority })
  }

  const wantsNoDeadline = input.deadline === 'no-deadline' || input.hasDeadline === false
  const wantsHasDeadline = input.hasDeadline === true

  if (wantsNoDeadline) {
    filters.push({ field: 'applicationDeadline', operator: '==', value: null })
  } else if (wantsHasDeadline) {
    filters.push({ field: 'applicationDeadline', operator: '!=', value: null })
  } else if (input.deadline && input.deadline !== 'any' && input.deadline !== 'all') {
    const cutoff = deadlineCutoff(input.deadline)
    if (cutoff) {
      filters.push({ field: 'applicationDeadline', operator: '<=', value: cutoff })
    }
  }

  return filters
}

export function buildOpportunityListOrderBy(
  sortBy: OpportunityListQuery['sortBy'] = 'relevance',
  sortOrder: OpportunityListQuery['sortOrder'] = 'desc',
): Array<{ field: string; direction: 'asc' | 'desc' }> {
  const direction = sortOrder === 'asc' ? 'asc' : 'desc'
  switch (sortBy) {
    case 'dateUpdated':
      return [{ field: 'dateUpdated', direction }]
    case 'budget':
      return [{ field: 'budget.min', direction }]
    case 'deadline':
      return [{ field: 'applicationDeadline', direction }]
    case 'location':
      return [{ field: 'location', direction }]
    case 'dateCreated':
      return [{ field: 'dateCreated', direction }]
    case 'relevance':
    default:
      return [
        { field: 'dateCreated', direction: 'desc' },
        { field: 'priority', direction: 'asc' },
      ]
  }
}

/** Cursor: dateCreated of the startAfter document (same contract as getOpportunitiesForRole). */
export async function applyOpportunityDateCursor(
  filters: DbFilter[],
  startAfter?: string,
): Promise<void> {
  if (!startAfter) return
  const cursorDoc = await db().findDocById('opportunities', startAfter)
  if (!cursorDoc.success || !cursorDoc.data) return
  const cursorDate =
    (cursorDoc.data as { dateCreated?: string; date_created?: string }).dateCreated ??
    (cursorDoc.data as { date_created?: string }).date_created
  if (cursorDate) {
    filters.push({ field: 'dateCreated', operator: '<', value: cursorDate })
  } else {
    filters.push({ field: 'id', operator: '!=', value: startAfter })
  }
}
