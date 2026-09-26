import 'server-only'

import { logger } from '@/lib/logger'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import { getMainCurrencyCreditAccountingRate } from '@/lib/payments/credit-balance'
import { isCreditRewardsEnabled } from '@/lib/ring-config-core'
import { touchesFromUnknown } from '@/features/curtain/lib/attribution-storage'
import { commissionPercentForMint } from '@/features/curtain/lib/advertise'
import type { CurtainAttributionTouch } from '@/features/curtain/types'
import type { StoreOrder } from '@/features/store/types'

function lineProductId(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const rec = item as Record<string, unknown>
  if (typeof rec.productId === 'string' && rec.productId) return rec.productId
  const product = rec.product
  if (product && typeof product === 'object' && product !== null && 'id' in product) {
    return String((product as { id?: unknown }).id || '')
  }
  return ''
}

function lineSubtotal(item: unknown): number {
  if (!item || typeof item !== 'object') return 0
  const rec = item as Record<string, unknown>
  const qty = Number(rec.quantity ?? rec.qty ?? 1) || 1
  const product = rec.product && typeof rec.product === 'object' ? (rec.product as Record<string, unknown>) : rec
  const price = Number(product.price ?? rec.price ?? rec.finalPrice ?? 0)
  if (!Number.isFinite(price) || price <= 0) return 0
  return price * qty
}

function touchesFromOrder(order: StoreOrder & Record<string, unknown>): CurtainAttributionTouch[] {
  const raw = order.curtainAttribution ?? (order as { data?: { curtainAttribution?: unknown } }).data?.curtainAttribution
  return touchesFromUnknown(raw, { applyWindow: false })
}

/**
 * Additive credit mint to the page author when a paid cart contains products
 * that were added via an in-curtain CTA on that author's page.
 * Trusts the checkout-stamped payload (already window-filtered at stamp time).
 * Does not take from vendor payout. Skips self-buy and duplicate order+product+author.
 */
export async function mintCurtainAuthorCommission(order: StoreOrder): Promise<{ minted: number }> {
  if (!isCreditRewardsEnabled()) return { minted: 0 }

  const buyerId = order.userId
  const items = (order.items || []) as unknown[]
  const touches = touchesFromOrder(order as StoreOrder & Record<string, unknown>)
  if (!buyerId || items.length === 0 || touches.length === 0) return { minted: 0 }

  const touchByProduct = new Map<string, CurtainAttributionTouch>()
  for (const touch of touches) {
    const prev = touchByProduct.get(touch.productId)
    if (!prev || touch.ctaAt > prev.ctaAt) touchByProduct.set(touch.productId, touch)
  }

  let minted = 0
  const rate = getMainCurrencyCreditAccountingRate()

  for (const item of items) {
    const productId = lineProductId(item)
    const touch = productId ? touchByProduct.get(productId) : undefined
    if (!touch?.authorUserId) continue
    if (touch.authorUserId === buyerId) continue
    if (touch.authorUserId === order.referrerUserId) {
      continue
    }
    const percent = commissionPercentForMint(touch.commissionPercent)
    const subtotal = lineSubtotal(item)
    if (percent == null || subtotal <= 0) continue
    const amount = ((subtotal * percent) / 100).toFixed(2)
    if (Number(amount) <= 0) continue

    const referenceId = `curtain_author:${order.id}:${productId}:${touch.authorUserId}`
    try {
      await creditBalanceService.addCredits(
        touch.authorUserId,
        {
          amount,
          description: `Curtain author commission (${percent}%)`,
          reference_id: referenceId,
          metadata: {
            source: 'curtain_author',
            orderId: order.id,
            offerId: touch.offerId,
            productId,
            pagePath: touch.pagePath,
            commissionPercent: percent,
          },
        },
        'reward_credit_add',
        rate,
      )
      minted += 1
    } catch (error) {
      logger.warn('Curtain author commission mint skipped', {
        orderId: order.id,
        productId,
        authorUserId: touch.authorUserId,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  return { minted }
}
