import { connection } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { db, initializeDatabase } from '@/lib/database'
import { getStoreSettings } from '@/features/store/services/store-settings-service'
import {
  mergeStoreSettings,
  type StoreSettingsData,
  type VendorShippingOverride,
} from '@/features/store/types/store-settings'
import { isNovaPostEnabled } from '@/lib/shipping/nova-post'
import { isStorePromoCodeActive } from '@/features/store/types/promotions'

/** Public checkout/cart config. Promo codes that are disabled or expired are omitted. */
export async function GET(request: NextRequest) {
  await connection()
  let settings = await getStoreSettings()
  const rawVendorParam = request.nextUrl.searchParams.get('vendorId')?.trim() || ''
  const vendorIds = [...new Set(rawVendorParam.split(',').map((s) => s.trim()).filter(Boolean))]
  const vendorShippingByEntityId: Record<string, VendorShippingOverride> = {}
  const keyConfigured = isNovaPostEnabled()
  if (vendorIds.length > 0) {
    try {
      await initializeDatabase()
      for (const vid of vendorIds) {
        const profile = await db().readDoc<Record<string, unknown>>('vendor_profiles', `vendor_${vid}`)
        const row = profile.success ? profile.data : null
        const shipping = row?.shipping
        const promos = (row?.promotions || {}) as {
          freeShipping?: StoreSettingsData['promotions']['freeShipping']
          checkoutSpecialOfferEnabled?: boolean
        }
        const mergedShipping =
          shipping && typeof shipping === 'object'
            ? mergeStoreSettings({ shipping }).shipping
            : settings.shipping
        vendorShippingByEntityId[vid] = {
          shipping: {
            ...mergedShipping,
            novaPost: {
              ...mergedShipping.novaPost,
              enabled: keyConfigured && mergedShipping.novaPost.enabled,
            },
          },
          freeShipping: promos.freeShipping ?? settings.promotions.freeShipping,
        }
        if (vendorIds.length === 1) {
          settings = {
            ...settings,
            shipping: mergedShipping,
            promotions: {
              ...settings.promotions,
              freeShipping: promos.freeShipping ?? settings.promotions.freeShipping,
              checkoutSpecialOfferEnabled:
                promos.checkoutSpecialOfferEnabled ?? settings.promotions.checkoutSpecialOfferEnabled,
            },
          }
        }
      }
    } catch {
      /* fallback to platform settings */
    }
  }
  const now = new Date()
  return NextResponse.json({
    novaPostKeyConfigured: keyConfigured,
    shipping: {
      ...settings.shipping,
      novaPost: {
        ...settings.shipping.novaPost,
        enabled: keyConfigured && settings.shipping.novaPost.enabled,
      },
    },
    ...(vendorIds.length > 1 ? { vendorShippingByEntityId } : {}),
    promoCodes: settings.promotions.promoCodes
      .filter((code) => isStorePromoCodeActive(code, now))
      .map((code) => ({
        code: code.code,
        discountType: code.discountType,
        value: code.value,
        minOrderAmount: code.minOrderAmount ?? 0,
        vendorEntityId: code.vendorEntityId || null,
        startsAt: code.startsAt,
        endsAt: code.endsAt,
        maxRedemptions: code.maxRedemptions,
        maxUsesPerUser: code.maxUsesPerUser,
        redemptionCount: code.redemptionCount ?? 0,
      })),
    freeShipping: settings.promotions.freeShipping,
    checkoutSpecialOfferEnabled: settings.promotions.checkoutSpecialOfferEnabled,
  })
}
