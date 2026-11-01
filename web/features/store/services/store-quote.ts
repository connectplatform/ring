import { db, getDatabaseService, initializeDatabase } from '@/lib/database'
import { convertToMainCurrency } from '@/lib/ring-config-core'
import { priceCartLine } from '@/features/store/lib/cart-pricing'
import { findStorePromoCode, type ProductPromotion } from '@/features/store/types/promotions'
import {
  mergeStoreSettings,
  quoteFromSettings,
  resolveConfiguredShipping,
  type StoreSettingsData,
  type VendorShippingOverride,
} from '@/features/store/types/store-settings'
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
  userId?: string | null
  buyerEmail?: string | null
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
  const vendorShippingByEntityId: Record<string, VendorShippingOverride> = {}
  for (const vid of vendorIds) {
    const profile = await db().readDoc<Record<string, unknown>>('vendor_profiles', `vendor_${vid}`)
    if (profile.success && profile.data) {
      vendorProfiles.set(vid, profile.data)
    }
    const row = profile.success ? profile.data : undefined
    const shipping = row?.shipping
    const freeShipping = (
      row?.promotions as { freeShipping?: StoreSettingsData['promotions']['freeShipping'] } | undefined
    )?.freeShipping
    vendorShippingByEntityId[vid] = {
      shipping:
        shipping && typeof shipping === 'object'
          ? mergeStoreSettings({ shipping }).shipping
          : settings.shipping,
      freeShipping: freeShipping ?? settings.promotions.freeShipping,
    }
  }

  if (vendorIds.length === 1) {
    const override = vendorShippingByEntityId[vendorIds[0]]
    if (override) {
      settings = {
        ...settings,
        shipping: override.shipping,
        promotions: { ...settings.promotions, freeShipping: override.freeShipping },
      }
    }
  } else if (vendorIds.length > 1) {
    settings = {
      ...settings,
      vendorShippingByEntityId,
    }
  }

  let effectivePromoCode = input.promoCode
  const candidatePromo = findStorePromoCode(settings.promotions.promoCodes, input.promoCode || '')
  if (
    candidatePromo &&
    typeof candidatePromo.maxUsesPerUser === 'number' &&
    candidatePromo.maxUsesPerUser > 0 &&
    (input.userId || input.buyerEmail)
  ) {
    const needle = candidatePromo.code.trim().toLowerCase()
    const emailNeedle = (input.buyerEmail || '').trim().toLowerCase()
    const dbService = getDatabaseService()
    const ordersRes = input.userId
      ? await dbService.query({
          collection: 'orders',
          filters: [{ field: 'userId', operator: '==', value: input.userId }],
          pagination: { limit: 200 },
        })
      : await dbService.query({
          collection: 'orders',
          pagination: { limit: 200 },
        })
    const rows: Array<Record<string, unknown>> =
      ordersRes.success && Array.isArray(ordersRes.data)
        ? ordersRes.data.map((doc) =>
            doc && typeof doc === 'object' && 'data' in doc && doc.data && typeof doc.data === 'object'
              ? (doc.data as Record<string, unknown>)
              : (doc as unknown as Record<string, unknown>),
          )
        : []
    const userUses = rows.filter((row) => {
      const code = String(row.promoCode || '').trim().toLowerCase()
      if (code !== needle) return false
      const status = String(row.status || '').toLowerCase()
      if (status === 'cancelled' || status === 'canceled') return false
      const paymentStatus = String(
        (row.payment as { status?: string } | undefined)?.status || '',
      ).toLowerCase()
      const counted =
        Boolean(row.promoRedemptionCounted) ||
        paymentStatus === 'paid' ||
        ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(status)
      if (!counted) return false
      if (input.userId && String(row.userId || '') === input.userId) return true
      if (emailNeedle) {
        const rowEmail = String(
          (row.shippingInfo as { email?: string } | undefined)?.email || '',
        )
          .trim()
          .toLowerCase()
        if (rowEmail === emailNeedle) return true
      }
      return false
    }).length
    if (userUses >= candidatePromo.maxUsesPerUser) {
      effectivePromoCode = null
    }
  }

  const quote = quoteFromSettings({
    lines,
    settings,
    method: input.method,
    promoCode: effectivePromoCode,
  })

  const activePromo = findStorePromoCode(settings.promotions.promoCodes, effectivePromoCode || '')
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
    const override = vendorShippingByEntityId[vid]
    const vendorShipping =
      vendorIds.length > 1 && override
        ? resolveConfiguredShipping(
            override.shipping,
            input.method,
            bucket.subtotal,
            override.freeShipping,
          )
        : vendorIds.length === 1
          ? quote.shipping
          : 0
    vendorSettlements.push({
      vendorId: vid,
      vendorEntityId: vid,
      productIds: bucket.productIds,
      subtotal: netSubtotal,
      shippingFee: vendorShipping,
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
