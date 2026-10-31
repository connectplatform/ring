import { db, initializeDatabase } from '@/lib/database'
import { convertToMainCurrency } from '@/lib/ring-config-core'
import { priceCartLine } from '@/features/store/lib/cart-pricing'
import { findStorePromoCode, type ProductPromotion } from '@/features/store/types/promotions'
import { mergeStoreSettings, quoteFromSettings, type StoreSettingsData } from '@/features/store/types/store-settings'
import { getStoreSettings } from '@/features/store/services/store-settings-service'
import type { VendorSettlement } from '@/features/store/types'

function tierCommissionRate(tier: string | undefined): number {
  const key = String(tier || 'NEW').toUpperCase()
  const rates: Record<string, number> = {
    NEW: 20,
    STARTER: 20,
    BASIC: 18,
    VERIFIED: 16,
    GROWTH: 15,
    TRUSTED: 14,
    PROFESSIONAL: 12,
    PREMIUM: 12,
    ENTERPRISE: 10,
  }
  return rates[key] ?? 20
}

export async function quoteStoreOrder(input: {
  items: Array<{ productId: string; quantity: number }>
  method?: string
  promoCode?: string | null
}) {
  await initializeDatabase()
  let settings = await getStoreSettings()
  const lines: Array<{
    productId: string
    unitPrice: number
    quantity: number
    promotions?: ProductPromotion[]
    vendorEntityId?: string
  }> = []

  for (const item of input.items) {
    const doc = await db().readDoc<Record<string, unknown>>('store_products', item.productId)
    if (!doc.success || !doc.data) {
      throw new Error(`Unknown product ${item.productId}`)
    }
    const rawPrice = parseFloat(String(doc.data.price ?? '0'))
    const priceMain = convertToMainCurrency(
      Number.isFinite(rawPrice) ? rawPrice : 0,
      typeof doc.data.currency === 'string' ? doc.data.currency : undefined,
    )
    const promotions = Array.isArray(doc.data.promotions)
      ? (doc.data.promotions as ProductPromotion[])
      : undefined
    lines.push({
      productId: item.productId,
      unitPrice: Number.isFinite(priceMain) ? priceMain : 0,
      quantity: Math.max(1, Math.floor(item.quantity)),
      promotions,
      vendorEntityId: String(doc.data.entity_id || doc.data.vendorId || doc.data.productOwner || ''),
    })
  }

  const vendorIds = [...new Set(lines.map((line) => line.vendorEntityId).filter((v): v is string => Boolean(v)))]
  const vendorProfiles = new Map<string, Record<string, unknown>>()
  for (const vid of vendorIds) {
    const profile = await db().readDoc<Record<string, unknown>>('vendor_profiles', `vendor_${vid}`)
    if (profile.success && profile.data) {
      vendorProfiles.set(vid, profile.data)
    }
  }

  if (vendorIds.length === 1) {
    const row = vendorProfiles.get(vendorIds[0])
    const shipping = row?.shipping
    const freeShipping = (row?.promotions as { freeShipping?: StoreSettingsData['promotions']['freeShipping'] } | undefined)
      ?.freeShipping
    if (shipping && typeof shipping === 'object') {
      settings = {
        ...settings,
        shipping: mergeStoreSettings({ shipping }).shipping,
        promotions: freeShipping
          ? { ...settings.promotions, freeShipping }
          : settings.promotions,
      }
    } else if (freeShipping) {
      settings = { ...settings, promotions: { ...settings.promotions, freeShipping } }
    }
  }

  const quote = quoteFromSettings({
    lines,
    settings,
    method: input.method,
    promoCode: input.promoCode,
  })

  const activePromo = findStorePromoCode(settings.promotions.promoCodes, input.promoCode || '')
  const byVendor = new Map<string, { productIds: string[]; subtotal: number }>()
  for (const line of lines) {
    const vid = line.vendorEntityId || ''
    if (!vid) continue
    const lineTotal = priceCartLine(line.unitPrice, line.quantity, line.promotions).lineTotal
    const bucket = byVendor.get(vid) || { productIds: [], subtotal: 0 }
    if (!bucket.productIds.includes(line.productId)) bucket.productIds.push(line.productId)
    bucket.subtotal += lineTotal
    byVendor.set(vid, bucket)
  }

  const vendorSettlements: VendorSettlement[] = []
  for (const [vid, bucket] of byVendor.entries()) {
    let vendorDiscount = 0
    if (quote.discount > 0) {
      if (activePromo?.vendorEntityId === vid) {
        vendorDiscount = Math.min(bucket.subtotal, quote.discount)
      } else if (!activePromo?.vendorEntityId && quote.subtotal > 0) {
        vendorDiscount = (bucket.subtotal / quote.subtotal) * quote.discount
      }
    }
    const netSubtotal = Math.max(0, Number((bucket.subtotal - vendorDiscount).toFixed(2)))
    const profile = vendorProfiles.get(vid)
    const commissionRate = tierCommissionRate(
      (profile?.storeTier || profile?.trustLevel || profile?.trustTier) as string | undefined,
    )
    const commission = Number(((netSubtotal * commissionRate) / 100).toFixed(2))
    const netAmount = Math.max(0, Number((netSubtotal - commission).toFixed(2)))
    vendorSettlements.push({
      vendorId: vid,
      vendorEntityId: vid,
      productIds: bucket.productIds,
      subtotal: netSubtotal,
      commission,
      commissionRate,
      netAmount,
      status: 'pending',
    })
  }

  return {
    ...quote,
    vendorSettlements,
  }
}
