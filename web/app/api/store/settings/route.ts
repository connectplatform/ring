import { connection } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { db, initializeDatabase } from '@/lib/database'
import { getStoreSettings } from '@/features/store/services/store-settings-service'
import { mergeStoreSettings, type StoreSettingsData } from '@/features/store/types/store-settings'
import { isNovaPostEnabled } from '@/lib/shipping/nova-post'
import { isStorePromoCodeActive } from '@/features/store/types/promotions'

/** Public checkout/cart config. Promo codes that are disabled or expired are omitted. */
export async function GET(request: NextRequest) {
  await connection()
  let settings = await getStoreSettings()
  const vendorId = request.nextUrl.searchParams.get('vendorId')?.trim()
  if (vendorId) {
    try {
      await initializeDatabase()
      const profile = await db().readDoc<Record<string, unknown>>('vendor_profiles', `vendor_${vendorId}`)
      const row = profile.success ? profile.data : null
      const shipping = row?.shipping
      const promos = (row?.promotions || {}) as {
        freeShipping?: StoreSettingsData['promotions']['freeShipping']
        checkoutSpecialOfferEnabled?: boolean
      }
      if (shipping && typeof shipping === 'object') {
        settings = {
          ...settings,
          shipping: mergeStoreSettings({ shipping }).shipping,
        }
      }
      if (promos.freeShipping) {
        settings = {
          ...settings,
          promotions: {
            ...settings.promotions,
            freeShipping: promos.freeShipping,
            checkoutSpecialOfferEnabled:
              promos.checkoutSpecialOfferEnabled ?? settings.promotions.checkoutSpecialOfferEnabled,
          },
        }
      }
    } catch {
      /* fallback to platform settings */
    }
  }
  const keyConfigured = isNovaPostEnabled()
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
        redemptionCount: code.redemptionCount ?? 0,
      })),
    freeShipping: settings.promotions.freeShipping,
    checkoutSpecialOfferEnabled: settings.promotions.checkoutSpecialOfferEnabled,
  })
}
