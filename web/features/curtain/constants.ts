import { REF_COOKIE_MAX_AGE_SECONDS } from '@/features/refcodes/constants'

/** Reuse the 30-day refcode cookie window for curtain CTA attribution. */
export const CURTAIN_ATTR_MAX_AGE_SECONDS = REF_COOKIE_MAX_AGE_SECONDS

export const CURTAIN_ATTR_COOKIE = 'ring_curtain_attr'
export const CURTAIN_ATTR_STORAGE_KEY = 'ring_curtain_attr'
export const CURTAIN_PREFS_STORAGE_KEY = 'ring_curtain_prefs'
export const CURTAIN_IMPRESSIONS_STORAGE_KEY = 'ring_curtain_impressions'

export const CURTAIN_PREFS_COLLECTION = 'curtain_preferences'

export const A2HS_OFFER_ID = 'a2hs:platform'

/** Soft cap so scroll-stop re-drops cannot spam. Not-for-me still wins forever. */
export const CURTAIN_MAX_IMPRESSIONS_PER_DAY = 5

export const CURTAIN_NOT_TODAY_MS = 24 * 60 * 60 * 1000
export const CURTAIN_SCROLL_STOP_MS = 480
export const CURTAIN_HEIGHT_VH = 10

export const CURTAIN_COMMISSION_MIN = 1
export const CURTAIN_COMMISSION_MAX = 10
export const CURTAIN_COMMISSION_DEFAULT = 5

/** Cookie + localStorage keep a short recency list so `ring_curtain_attr` stays under 4KB. */
export const CURTAIN_ATTR_MAX_TOUCHES = 12
export const CURTAIN_ATTR_COOKIE_MAX_CHARS = 3500
export const CURTAIN_ATTR_PATH_MAX = 160

/** Wait for `ring:curtain-page` (sibling chrome) before the first auto-drop. */
export const CURTAIN_PAGE_GATE_MS = 400

export const CURTAIN_EVENT_TYPES = {
  shown: 'curtain_shown',
  response: 'curtain_response',
  cta: 'curtain_cta',
  suppress: 'curtain_suppress',
} as const

export const CURTAIN_DROP_EVENT = 'ring:curtain-drop'
export const CURTAIN_PAGE_EVENT = 'ring:curtain-page'
