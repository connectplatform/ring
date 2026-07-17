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
    data.data ??
    data.opportunities ??
    data.entities ??
    data.pools ??
    data.transactions ??
    data.notifications ??
    []

  const explicitHasMore =
    typeof data.hasMore === 'boolean'
      ? data.hasMore
      : typeof data.has_more === 'boolean'
        ? data.has_more
        : undefined

  if (typeof explicitHasMore === 'boolean') {
    const cursor =
      data.cursor ??
      data.next_cursor ??
      data.lastVisible ??
      (explicitHasMore && items.length > 0 ? items[items.length - 1].id : null)
    return { items, cursor: explicitHasMore ? cursor : null, hasMore: explicitHasMore }
  }

  const { nextCursor, hasMore } = computePaginationCursor(items, limit, (item) => item.id)
  const cursor = data.cursor ?? data.next_cursor ?? data.lastVisible ?? nextCursor

  return {
    items,
    cursor: hasMore ? cursor : null,
    hasMore,
  }
}
