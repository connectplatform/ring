import { db, initializeDatabase } from '@/lib/database'
import {
  DEFAULT_STORE_SETTINGS,
  mergeStoreSettings,
  type StoreSettingsData,
} from '@/features/store/types/store-settings'

const COLLECTION = 'platform_settings'
const DOC_ID = 'store'

export async function getStoreSettings(): Promise<StoreSettingsData> {
  try {
    await initializeDatabase()
    const doc = await db().readDoc<Record<string, unknown>>(COLLECTION, DOC_ID)
    if (!doc.success || !doc.data) return DEFAULT_STORE_SETTINGS
    return mergeStoreSettings({
      shipping: doc.data.shipping,
      promotions: doc.data.promotions,
      referralCommissionPercent: doc.data.referralCommissionPercent as number | undefined,
    })
  } catch {
    return DEFAULT_STORE_SETTINGS
  }
}

export async function saveStoreSettings(next: StoreSettingsData, updatedBy: string): Promise<StoreSettingsData> {
  const merged = mergeStoreSettings(next)
  await initializeDatabase()
  const existing = await db().readDoc<Record<string, unknown>>(COLLECTION, DOC_ID)
  const payload = {
    shipping: merged.shipping,
    promotions: merged.promotions,
    referralCommissionPercent: merged.referralCommissionPercent,
    updatedBy,
    updatedAt: new Date().toISOString(),
  }
  if (existing.success && existing.data) {
    const update = await db().updateDoc(COLLECTION, DOC_ID, payload)
    if (!update.success) {
      throw update.error || new Error('Failed to update store settings')
    }
  } else {
    const create = await db().createDoc(COLLECTION, payload, { id: DOC_ID })
    if (!create.success) {
      throw create.error || new Error('Failed to create store settings')
    }
  }
  return merged
}

export async function incrementPromoCodeRedemption(code: string): Promise<void> {
  const needle = code.trim().toLowerCase()
  if (!needle) return
  const current = await getStoreSettings()
  let matchedVendorId: string | null | undefined
  const promoCodes = current.promotions.promoCodes.map((promo) => {
    if (promo.code.trim().toLowerCase() !== needle) return promo
    matchedVendorId = promo.vendorEntityId
    return { ...promo, redemptionCount: (promo.redemptionCount ?? 0) + 1 }
  })
  if (!promoCodes.some((promo, index) => promo !== current.promotions.promoCodes[index])) return
  await saveStoreSettings(
    { ...current, promotions: { ...current.promotions, promoCodes } },
    'checkout',
  )
  if (matchedVendorId) {
    const profileId = `vendor_${matchedVendorId}`
    const existing = await db().readDoc<Record<string, unknown>>('vendor_profiles', profileId)
    if (existing.success && existing.data) {
      const prevPromos = (existing.data.promotions || {}) as Record<string, unknown>
      const vendorCodes = promoCodes.filter((p) => p.vendorEntityId === matchedVendorId)
      await db()
        .updateDoc('vendor_profiles', profileId, {
          promotions: { ...prevPromos, promoCodes: vendorCodes },
          updatedAt: new Date().toISOString(),
        })
        .catch(() => undefined)
    }
  }
}
