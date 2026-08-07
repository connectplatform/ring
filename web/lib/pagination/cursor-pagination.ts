/**
 * Shared cursor-pagination helpers for list feeds (opportunities, entities, etc.).
 */

export interface PaginatedBatch<T> {
  items: T[]
  limit: number
}

export interface PaginationCursorResult {
  /** Next page cursor; null when the feed is exhausted. */
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Full page ⇒ more data may exist; short page ⇒ end of feed.
 */
export function computePaginationCursor<T>(
  items: T[],
  limit: number,
  getId: (item: T) => string,
): PaginationCursorResult {
  const hasMore = items.length > 0 && items.length >= limit
  const nextCursor = hasMore ? getId(items[items.length - 1]) : null
  return { nextCursor, hasMore }
}

export function mergeUniqueById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
): { merged: T[]; added: T[] } {
  const seen = new Set(existing.map((item) => item.id))
  const added = incoming.filter((item) => !seen.has(item.id))
  return { merged: [...existing, ...added], added }
}

/**
 * Client-side guard: stop when API repeats the cursor or returns only duplicates.
 */
export function resolveNextClientCursor(args: {
  previousCursor: string | null
  apiCursor: string | null | undefined
  addedCount: number
  fetchedCount: number
}): string | null {
  const { previousCursor, apiCursor, addedCount, fetchedCount } = args

  if (fetchedCount === 0 || addedCount === 0) {
    return null
  }

  if (!apiCursor) {
    return null
  }

  if (previousCursor && apiCursor === previousCursor) {
    return null
  }

  return apiCursor
}

export function shouldTriggerInfiniteScroll(args: {
  inView: boolean
  loading: boolean
  hasMore: boolean
}): boolean {
  return args.inView && !args.loading && args.hasMore
}
