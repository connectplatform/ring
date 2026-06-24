/**
 * Ring-wide cursor feed pagination types (SSOT).
 */

export const CURSOR_FEED_MODULE_IDS = [
  'opportunities',
  'entities',
  'store',
  'nft-market',
  'public-pools',
  'publications',
  'news',
  'reviews',
  'meetups',
  'contacts',
] as const

export type CursorFeedModuleId = (typeof CURSOR_FEED_MODULE_IDS)[number]

export const FEED_SESSION_VERSION = 'v1' as const

export interface PaginatedListResponse<T> {
  items: T[]
  cursor: string | null
  hasMore: boolean
}

/** Legacy API shapes during migration */
export interface LegacyPaginatedPayload<T = unknown> {
  items?: T[]
  opportunities?: T[]
  entities?: T[]
  cursor?: string | null
  lastVisible?: string | null
  hasMore?: boolean
}

export interface FeedSessionState<T> {
  version: typeof FEED_SESSION_VERSION
  filterFingerprint: string
  cursor: string | null
  hasMore: boolean
  items: T[]
  scrollY: number
  timestamp: number
}

export interface FeedSessionStorageEnvelope<T> {
  version: typeof FEED_SESSION_VERSION
  moduleId: CursorFeedModuleId
  locale: string
  state: FeedSessionState<T>
}
