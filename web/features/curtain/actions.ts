'use server'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { getVendorEntities } from '@/features/entities/services/vendor-entity'
import { collectProductImageUrls, galleryItemUrl } from '@/features/generative-media/types'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import { localeFromPathname } from '@/lib/pathname-without-locale'
import {
  A2HS_OFFER_ID,
  CURTAIN_COMMISSION_DEFAULT,
  CURTAIN_HEIGHT_VH,
} from '@/features/curtain/constants'
import { applyNotForMe, applyNotToday, canShowOffer, impressionsUsedToday } from '@/features/curtain/lib/frequency'
import {
  isEligibleCurtain,
  isVendorsOwnProduct,
  productHasSellablePrice,
  shouldSkipCurtainPath,
} from '@/features/curtain/lib/eligibility'
import { readCurtainAdvertiseFromProduct } from '@/features/curtain/lib/advertise'
import { loadCurtainPrefs, saveCurtainPrefs } from '@/features/curtain/services/prefs-db'
import { parseCurtainPrefs } from '@/features/curtain/lib/prefs-storage'
import type { CurtainDropParams, CurtainPrefsDoc, CurtainResponseType } from '@/features/curtain/types'

export async function syncCurtainPrefs(incoming: CurtainPrefsDoc): Promise<CurtainPrefsDoc> {
  const session = await auth()
  if (!session?.user?.id) return incoming
  return saveCurtainPrefs(session.user.id, incoming)
}

export async function loadServerCurtainPrefs(): Promise<CurtainPrefsDoc> {
  const session = await auth()
  if (!session?.user?.id) return { offers: {}, updatedAt: new Date(0).toISOString() }
  return loadCurtainPrefs(session.user.id)
}

export async function recordCurtainResponse(input: {
  offerId: string
  response: CurtainResponseType
  visibleMs?: number
  kind?: string
}): Promise<{ ok: true }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: true }
  const prefs = await loadCurtainPrefs(session.user.id)
  const prev = prefs.offers[input.offerId]
  const nextPref =
    input.response === 'not_for_me'
      ? applyNotForMe(prev)
      : input.response === 'not_today'
        ? applyNotToday(prev)
        : null
  if (!nextPref) return { ok: true }
  await saveCurtainPrefs(session.user.id, {
    ...prefs,
    offers: { ...prefs.offers, [input.offerId]: nextPref },
    updatedAt: new Date().toISOString(),
  })
  return { ok: true }
}

function storeProductHref(pathname: string, productId: string): string {
  const locale = localeFromPathname(pathname)
  if (locale === DEFAULT_LOCALE) return `/store/${productId}`
  return `/${locale}/store/${productId}`
}

function productMediaUrl(product: Record<string, unknown>): string {
  const gallery = product.generativeGallery as
    | { items?: Array<{ originalUrl?: string; webpUrl?: string; isPrimary?: boolean }> }
    | undefined
  const primary = gallery?.items?.find((item) => item.isPrimary) || gallery?.items?.[0]
  return (primary ? galleryItemUrl(primary as never) : '') || collectProductImageUrls(product)[0] || ''
}

async function loadAdvertisedProducts(): Promise<Record<string, unknown>[]> {
  const advertised = await db().queryDocs<Record<string, unknown>>({
    collection: 'store_products',
    filters: [
      { field: 'status', operator: '=', value: 'active' },
      { field: 'curtainAdvertiseEnabled', operator: '=', value: 'true' },
    ],
    pagination: { limit: 80 },
  })
  if (advertised.success && advertised.data.length > 0) return advertised.data

  const fallback = await db().queryDocs<Record<string, unknown>>({
    collection: 'store_products',
    filters: [{ field: 'status', operator: '=', value: 'active' }],
    pagination: { limit: 120 },
  })
  return fallback.success ? fallback.data : []
}

export async function requestCurtainDrop(input: {
  pathname: string
  isStandalone: boolean
  authorUserId?: string
  locale?: string
}): Promise<CurtainDropParams | null> {
  if (shouldSkipCurtainPath(input.pathname)) return null

  const session = await auth()
  const userId = session?.user?.id
  const prefs = userId ? await loadCurtainPrefs(userId) : parseCurtainPrefs(null)

  const a2hsOffer = (): CurtainDropParams => ({
    offerId: A2HS_OFFER_ID,
    kind: 'a2hs',
    line1: { text: '' },
    ctaText: '',
    ctaAction: 'a2hs',
    heightVh: CURTAIN_HEIGHT_VH,
    pagePath: input.pathname,
  })

  const a2hsEligible =
    isEligibleCurtain('a2hs', { isStandalone: input.isStandalone }) &&
    canShowOffer(prefs.offers[A2HS_OFFER_ID])

  if (input.authorUserId) {
    const vendorEntities = userId ? await getVendorEntities(userId) : []
    const vendorIds = vendorEntities.map((entity) => entity.id).filter(Boolean)

    const products = await loadAdvertisedProducts()
    const candidates: CurtainDropParams[] = []
    for (const product of products) {
      const advertise = readCurtainAdvertiseFromProduct(product)
      if (!advertise.enabled) continue
      if (!productHasSellablePrice(product as { price?: unknown })) continue
      if (isVendorsOwnProduct(product, vendorIds)) continue
      const offerId = `product:${product.id}`
      if (!canShowOffer(prefs.offers[offerId])) continue
      const name = String(product.name || '')
      const price = Number(product.price)
      candidates.push({
        offerId,
        kind: 'product',
        mediaUrl: productMediaUrl(product),
        line1: { text: name },
        line2: { text: '' },
        ctaText: '',
        ctaAction: 'add_to_cart',
        ctaHref: storeProductHref(input.pathname, String(product.id)),
        heightVh: CURTAIN_HEIGHT_VH,
        productId: String(product.id),
        productName: name,
        productPrice: Number.isFinite(price) ? price : undefined,
        authorUserId: input.authorUserId,
        pagePath: input.pathname,
        commissionPercent: advertise.commissionPercent || CURTAIN_COMMISSION_DEFAULT,
        productCurrency: typeof product.currency === 'string' ? product.currency : undefined,
      })
    }
    candidates.sort(
      (a, b) =>
        impressionsUsedToday(prefs.offers[a.offerId]) - impressionsUsedToday(prefs.offers[b.offerId]),
    )
    if (candidates[0]) return candidates[0]
  }

  if (a2hsEligible) return a2hsOffer()
  return null
}
