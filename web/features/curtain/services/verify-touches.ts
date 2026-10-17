import 'server-only'

import { db } from '@/lib/database'
import { CURTAIN_ATTR_MAX_AGE_SECONDS } from '@/features/curtain/constants'
import { readCurtainAdvertiseFromProduct } from '@/features/curtain/lib/advertise'
import { touchesFromUnknown } from '@/features/curtain/lib/attribution-storage'
import { verifyCurtainOfferToken } from '@/features/curtain/lib/offer-token'
import { productHasSellablePrice } from '@/features/curtain/lib/eligibility'
import type { CurtainAttributionTouch } from '@/features/curtain/types'

const WINDOW_MS = CURTAIN_ATTR_MAX_AGE_SECONDS * 1000
const SKEW_MS = 60_000

function vendorIdOf(product: Record<string, unknown>): string {
  const id = product.entity_id ?? product.entityId ?? product.vendorId ?? product.ownerEntityId
  return id == null ? '' : String(id)
}

/**
 * Keep only HMAC-signed touches. Author and percent come from the token and the
 * live product, never from the browser payload.
 */
export async function verifyCurtainTouches(raw: unknown, now = Date.now()): Promise<CurtainAttributionTouch[]> {
  const incoming = touchesFromUnknown(raw, { applyWindow: false })
  const verified: CurtainAttributionTouch[] = []
  const seen = new Set<string>()

  for (const touch of incoming) {
    if (!touch.offerToken) continue
    const payload = verifyCurtainOfferToken(touch.offerToken, now)
    if (!payload || payload.productId !== touch.productId) continue
    if (touch.ctaAt > now + SKEW_MS) continue
    if (now - touch.ctaAt > WINDOW_MS) continue
    if (touch.ctaAt + SKEW_MS < payload.issuedAt) continue
    if (seen.has(payload.productId)) continue

    const product = await db().findDocById<Record<string, unknown>>('store_products', payload.productId)
    if (!product.success || !product.data) continue
    const doc = product.data
    if (String(doc.status || '') !== 'active') continue
    if (!productHasSellablePrice(doc as { price?: unknown })) continue
    const advertise = readCurtainAdvertiseFromProduct(doc)
    if (!advertise.enabled) continue

    seen.add(payload.productId)
    verified.push({
      offerId: payload.offerId,
      productId: payload.productId,
      authorUserId: payload.authorUserId,
      newsArticleId: payload.newsArticleId,
      pagePath: touch.pagePath,
      commissionPercent: advertise.commissionPercent,
      ctaAt: touch.ctaAt,
      offerToken: touch.offerToken,
      vendorId: vendorIdOf(doc),
    })
  }

  return verified
}
