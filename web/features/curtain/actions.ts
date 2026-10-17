'use server'

import { auth } from '@/auth'
import { db } from '@/lib/database'
import { getVendorEntities } from '@/features/entities/services/vendor-entity'
import { collectProductImageUrls, galleryItemUrl } from '@/features/generative-media/types'
import { canViewNewsArticle } from '@/features/news/lib/news-visibility-filter'
import { DEFAULT_LOCALE } from '@/lib/locale-config'
import { localeFromPathname } from '@/lib/pathname-without-locale'
import { getCurtainPolicy } from '@/lib/ring-config-core'
import {
  A2HS_OFFER_ID,
  CURTAIN_COMMISSION_DEFAULT,
  CURTAIN_HEIGHT_VH,
  CURTAIN_QUEUE_MAX,
} from '@/features/curtain/constants'
import { applyNotForMe, applyNotToday, canShowOffer, impressionsUsedToday } from '@/features/curtain/lib/frequency'
import {
  isEligibleCurtain,
  isVendorsOwnProduct,
  productHasSellablePrice,
  shouldSkipCurtainPath,
} from '@/features/curtain/lib/eligibility'
import { readCurtainAdvertiseFromProduct } from '@/features/curtain/lib/advertise'
import { signCurtainOffer } from '@/features/curtain/lib/offer-token'
import { curtainOfferScore, extractCurtainProductIds, topicOverlap } from '@/features/curtain/lib/page-products'
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
  const policy = getCurtainPolicy()
  const prev = prefs.offers[input.offerId]
  const nextPref =
    input.response === 'not_for_me'
      ? applyNotForMe(prev)
      : input.response === 'not_today'
        ? applyNotToday(prev, Date.now(), policy.notTodayHours)
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

function vendorIdOf(product: Record<string, unknown>): string {
  const id = product.entity_id ?? product.entityId ?? product.vendorId ?? product.ownerEntityId
  return id == null ? '' : String(id)
}

function productTopics(product: Record<string, unknown>): string[] {
  const tags = Array.isArray(product.tags) ? product.tags.map(String) : []
  const category = typeof product.category === 'string' ? [product.category] : []
  return [...category, ...tags]
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

async function loadProductsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
  const docs = await Promise.all(
    ids.map((id) => db().findDocById<Record<string, unknown>>('store_products', id)),
  )
  return docs.flatMap((result) => (result.success && result.data ? [result.data] : []))
}

export async function requestCurtainDrop(input: {
  pathname: string
  isStandalone: boolean
  newsArticleId?: string
  excludeOfferIds?: string[]
}): Promise<{ offers: CurtainDropParams[] }> {
  const policy = getCurtainPolicy()
  if (!policy.enabled || shouldSkipCurtainPath(input.pathname)) return { offers: [] }

  const session = await auth()
  const userId = session?.user?.id
  const prefs = userId ? await loadCurtainPrefs(userId) : parseCurtainPrefs(null)
  const excluded = new Set(input.excludeOfferIds || [])
  const now = Date.now()

  const a2hsOffer = (): CurtainDropParams => ({
    offerId: A2HS_OFFER_ID,
    kind: 'a2hs',
    line1: { text: '' },
    ctaText: '',
    ctaAction: 'a2hs',
    heightVh: CURTAIN_HEIGHT_VH,
    pagePath: input.pathname,
    newsArticleId: input.newsArticleId,
  })

  const a2hsEligible =
    !excluded.has(A2HS_OFFER_ID) &&
    isEligibleCurtain('a2hs', { isStandalone: input.isStandalone }) &&
    canShowOffer(prefs.offers[A2HS_OFFER_ID], now, policy.maxImpressionsPerDay)

  let authorUserId = ''
  let pageTopics: string[] = []
  let linkedIds: string[] = []

  if (input.newsArticleId) {
    const article = await db().findDocById<Record<string, unknown>>('news', input.newsArticleId)
    if (article.success && article.data) {
      const doc = article.data
      authorUserId = String(doc.authorId || '')
      const status = String(doc.status || '')
      const visible = canViewNewsArticle(
        {
          id: String(doc.id || input.newsArticleId),
          visibility: typeof doc.visibility === 'string' ? doc.visibility : undefined,
          authorId: authorUserId,
          status,
        },
        { userId, userRole: session?.user?.role },
      )
      const published = status === 'published' || (Boolean(userId) && userId === authorUserId)
      if (visible && published && authorUserId) {
        pageTopics = [
          ...(typeof doc.category === 'string' ? [doc.category] : []),
          ...(Array.isArray(doc.tags) ? doc.tags.map(String) : []),
        ]
        linkedIds = extractCurtainProductIds(String(doc.content || ''))
      } else {
        authorUserId = ''
      }
    }
  }

  const vendorEntities = userId ? await getVendorEntities(userId) : []
  const vendorIds = vendorEntities.map((entity) => entity.id).filter(Boolean)
  const wantPage = policy.productSource !== 'pool_only'
  const wantPool = policy.productSource !== 'page_only'
  const pageProducts = wantPage && authorUserId ? await loadProductsByIds(linkedIds) : []
  const poolProducts =
    wantPool && authorUserId && (policy.productSource === 'pool_only' || pageProducts.length < CURTAIN_QUEUE_MAX)
      ? await loadAdvertisedProducts()
      : []

  const byId = new Map<string, { product: Record<string, unknown>; fromPage: boolean }>()
  for (const product of pageProducts) byId.set(String(product.id), { product, fromPage: true })
  for (const product of poolProducts) {
    const id = String(product.id)
    if (!byId.has(id)) byId.set(id, { product, fromPage: false })
  }

  const candidates: Array<CurtainDropParams & { score: number }> = []
  for (const { product, fromPage } of byId.values()) {
    const advertise = readCurtainAdvertiseFromProduct(product)
    if (!advertise.enabled) continue
    if (String(product.status || '') !== 'active') continue
    if (!productHasSellablePrice(product as { price?: unknown })) continue
    if (isVendorsOwnProduct(product, vendorIds)) continue
    const offerId = `product:${product.id}`
    if (excluded.has(offerId)) continue
    if (!canShowOffer(prefs.offers[offerId], now, policy.maxImpressionsPerDay)) continue
    if (!input.newsArticleId || !authorUserId) continue
    const name = String(product.name || '')
    const price = Number(product.price)
    const overlap = topicOverlap(pageTopics, productTopics(product))
    const impressions = impressionsUsedToday(prefs.offers[offerId], now)
    const offer: CurtainDropParams = {
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
      productCurrency: typeof product.currency === 'string' ? product.currency : undefined,
      authorUserId,
      pagePath: input.pathname,
      newsArticleId: input.newsArticleId,
      vendorId: vendorIdOf(product),
      fromPage,
      commissionPercent: advertise.commissionPercent || CURTAIN_COMMISSION_DEFAULT,
      offerToken: signCurtainOffer({
        offerId,
        productId: String(product.id),
        authorUserId,
        newsArticleId: input.newsArticleId || '',
        issuedAt: now,
      }),
    }
    candidates.push({
      ...offer,
      score: curtainOfferScore({ fromPage, overlap, impressions }),
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  const offers: CurtainDropParams[] = candidates.slice(0, CURTAIN_QUEUE_MAX).map(({ score: _score, ...offer }) => offer)
  if (offers.length < CURTAIN_QUEUE_MAX && a2hsEligible) offers.push(a2hsOffer())
  return { offers: offers.slice(0, CURTAIN_QUEUE_MAX) }
}
