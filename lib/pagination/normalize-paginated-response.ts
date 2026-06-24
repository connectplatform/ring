import type { LegacyPaginatedPayload, PaginatedListResponse } from '@/lib/pagination/types'
import { computePaginationCursor } from '@/lib/pagination/cursor-pagination'

/**
 * Normalize legacy API payloads to PaginatedListResponse SSOT.
 */
export function normalizePaginatedResponse<T extends { id: string }>(
  data: LegacyPaginatedPayload<T>,
  limit: number,
): PaginatedListResponse<T> {
  const items =
    data.items ??
    data.opportunities ??
    data.entities ??
    []

  if (typeof data.hasMore === 'boolean') {
    const cursor =
      data.cursor ?? data.lastVisible ?? (data.hasMore && items.length > 0 ? items[items.length - 1].id : null)
    return { items, cursor: data.hasMore ? cursor : null, hasMore: data.hasMore }
  }

  const { nextCursor, hasMore } = computePaginationCursor(items, limit, (item) => item.id)
  const cursor = data.cursor ?? data.lastVisible ?? nextCursor

  return {
    items,
    cursor: hasMore ? cursor : null,
    hasMore,
  }
}
