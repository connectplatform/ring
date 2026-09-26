import { pathnameWithoutLocaleClient } from '@/lib/pathname-without-locale'
import type { CurtainDropParams, CurtainKind } from '@/features/curtain/types'

const SKIP_PREFIXES = [
  '/admin',
  '/login',
  '/register',
  '/auth',
  '/vendor',
  '/store/checkout',
]

export function shouldSkipCurtainPath(pathname: string): boolean {
  const path = pathnameWithoutLocaleClient(pathname)
  return SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

const APP_ROOTS = new Set([
  'store',
  'admin',
  'login',
  'register',
  'auth',
  'vendor',
  'docs',
  'wallet',
  'messages',
  'opportunities',
  'entities',
  'nft',
  'dao',
  'games',
  'membership',
  'profile',
  'settings',
  'notifications',
  'tasks',
  'contacts',
  'marketplace',
  'confidential',
  'about',
  'contact',
  'privacy',
  'terms',
  'roadmap',
  'changelog',
])

/** News article, author index, or /{username}/{slug} — wait for CurtainPageProvider. */
export function pathMayHavePageAuthor(pathname: string): boolean {
  const path = pathnameWithoutLocaleClient(pathname)
  if (path.startsWith('/news/')) {
    const first = path.slice('/news/'.length).split('/')[0]
    return Boolean(first) && first !== 'category' && first !== 'categories'
  }
  const segs = path.split('/').filter(Boolean)
  return segs.length >= 2 && !APP_ROOTS.has(segs[0])
}

export function shouldHideA2hs(isStandalone: boolean): boolean {
  return isStandalone
}

/**
 * Product-ad eligibility — industry-aligned:
 * - Hide vendor’s own SKU (self-dealing / wasted inventory).
 * - Hide when there is no sellable price.
 * - Show to logged-out guests (Amazon/Meta/Google all advertise to anonymous;
 *   attribution cookie still stamps so a later paid cart can mint).
 */
export function shouldHideProductAd(opts: {
  hasPrice: boolean
  isVendorsOwnProduct: boolean
}): boolean {
  if (!opts.hasPrice) return true
  if (opts.isVendorsOwnProduct) return true
  return false
}

export function isEligibleCurtain(
  kind: CurtainKind,
  opts: {
    isStandalone: boolean
    hasPrice?: boolean
    isVendorsOwnProduct?: boolean
  },
): boolean {
  if (kind === 'a2hs') return !shouldHideA2hs(opts.isStandalone)
  return !shouldHideProductAd({
    hasPrice: Boolean(opts.hasPrice),
    isVendorsOwnProduct: Boolean(opts.isVendorsOwnProduct),
  })
}

export function pauseCurtainForRealtime(opts: {
  callBusy: boolean
  gameBusy: boolean
}): boolean {
  return opts.callBusy || opts.gameBusy
}

export function productHasSellablePrice(product: {
  price?: unknown
} | Record<string, unknown> | null | undefined): boolean {
  const raw = product?.price
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0
}

export function isVendorsOwnProduct(
  product: Record<string, unknown> | null | undefined,
  vendorEntityIds: string[],
): boolean {
  if (!product || vendorEntityIds.length === 0) return false
  const ids = new Set(vendorEntityIds.filter(Boolean).map(String))
  const candidates = [
    product.entity_id,
    product.entityId,
    product.vendorId,
    product.ownerEntityId,
    product.productOwner,
  ]
  return candidates.some((id) => id != null && ids.has(String(id)))
}

export function curtainParamsNeedMedia(params: CurtainDropParams): boolean {
  return params.kind === 'product' && !params.mediaUrl
}
