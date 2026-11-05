import type { FreeShippingMode, StorePromoCode, VendorFreeShippingPromotion } from '@/features/store/types/promotions'
import { computePromoCodeDiscount, findStorePromoCode } from '@/features/store/types/promotions'
import { sumPromotedLines } from '@/features/store/lib/cart-pricing'
import type { ProductPromotion } from '@/features/store/types/promotions'

export interface StoreShippingMethodConfig {
  enabled: boolean
  /** Price in the store main currency. Pickup is usually 0. */
  price: number
  /** Short ETA label, e.g. "1-3" (business days are added in the UI). */
  estimatedDays: string
  address?: string
  hours?: string
}

export interface StoreShippingSettings {
  novaPost: StoreShippingMethodConfig
  pickup: StoreShippingMethodConfig
  defaultMethod: 'nova-post' | 'pickup'
}

export interface StorePromotionsSettings {
  promoCodes: StorePromoCode[]
  freeShipping: VendorFreeShippingPromotion
  checkoutSpecialOfferEnabled: boolean
}

export interface VendorShippingOverride {
  shipping: StoreShippingSettings
  freeShipping: VendorFreeShippingPromotion
}

export interface StoreSettingsData {
  shipping: StoreShippingSettings
  promotions: StorePromotionsSettings
  /** Global referral percent used when the product and merchant do not set one. */
  referralCommissionPercent?: number
  /** Optional per-vendor shipping overrides for multi-vendor carts. */
  vendorShippingByEntityId?: Record<string, VendorShippingOverride>
}

export const DEFAULT_WELCOME_PROMO: StorePromoCode = {
  id: 'welcome10',
  code: 'WELCOME10',
  discountType: 'fixed',
  value: 5,
  minOrderAmount: 0,
  enabled: true,
  description: 'Welcome discount',
}

export const DEFAULT_STORE_SETTINGS: StoreSettingsData = {
  shipping: {
    novaPost: { enabled: true, price: 65, estimatedDays: '1-3' },
    pickup: {
      enabled: true,
      price: 0,
      estimatedDays: '',
      address: '',
      hours: '',
    },
    defaultMethod: 'nova-post',
  },
  promotions: {
    promoCodes: [DEFAULT_WELCOME_PROMO],
    freeShipping: { mode: 'off' as FreeShippingMode },
    checkoutSpecialOfferEnabled: false,
  },
}

export function publicPromoCodes(codes: StorePromoCode[]): StorePromoCode[] {
  return codes
    .filter((code) => code.enabled && code.code.trim())
    .map((code) => ({
      id: code.id || code.code,
      code: code.code.trim(),
      discountType: code.discountType,
      value: code.value,
      minOrderAmount: code.minOrderAmount ?? 0,
      enabled: true,
      description: code.description,
      vendorEntityId: code.vendorEntityId || null,
      startsAt: code.startsAt,
      endsAt: code.endsAt,
      maxRedemptions: code.maxRedemptions,
      maxUsesPerUser: code.maxUsesPerUser,
      redemptionCount: code.redemptionCount,
    }))
}

/** Shipping charge in the store main currency. Legacy express/standard map to Nova Post. */
export function resolveConfiguredShipping(
  shipping: StoreShippingSettings,
  method: string | undefined,
  subtotal: number,
  freeShipping: VendorFreeShippingPromotion,
): number {
  const normalized =
    method === 'express' || method === 'standard' ? 'nova-post' : method || shipping.defaultMethod
  let price = 0
  if (normalized === 'pickup') {
    price = shipping.pickup.enabled ? Math.max(0, shipping.pickup.price) : 0
  } else if (normalized === 'nova-post') {
    price = shipping.novaPost.enabled ? Math.max(0, shipping.novaPost.price) : 0
  }
  if (freeShipping.mode === 'always') return 0
  if (freeShipping.mode === 'conditional') {
    const min = typeof freeShipping.minOrderAmount === 'number' ? freeShipping.minOrderAmount : 0
    if (subtotal >= min) return 0
  }
  return price
}

export function quoteFromSettings(input: {
  lines: Array<{ unitPrice: number; quantity: number; promotions?: ProductPromotion[]; vendorEntityId?: string }>
  settings: StoreSettingsData
  method?: string
  promoCode?: string | null
}): { subtotal: number; discount: number; shipping: number; total: number; appliedCode: string | null } {
  const subtotal = sumPromotedLines(input.lines)
  const promo = findStorePromoCode(input.settings.promotions.promoCodes, input.promoCode || '')
  const eligibleLines = promo?.vendorEntityId
    ? input.lines.filter((line) => line.vendorEntityId === promo.vendorEntityId)
    : input.lines
  const eligible = sumPromotedLines(eligibleLines)
  const discount = computePromoCodeDiscount(eligible, promo || null)
  const vendorIds = [
    ...new Set(input.lines.map((line) => line.vendorEntityId).filter((v): v is string => Boolean(v))),
  ]
  let shipping = 0
  if (vendorIds.length > 1 && input.settings.vendorShippingByEntityId) {
    for (const vid of vendorIds) {
      const vendorLines = input.lines.filter((line) => line.vendorEntityId === vid)
      const vendorSubtotal = sumPromotedLines(vendorLines)
      const override = input.settings.vendorShippingByEntityId[vid]
      shipping += resolveConfiguredShipping(
        override?.shipping ?? input.settings.shipping,
        input.method,
        vendorSubtotal,
        override?.freeShipping ?? input.settings.promotions.freeShipping,
      )
    }
  } else {
    shipping = resolveConfiguredShipping(
      input.settings.shipping,
      input.method,
      subtotal,
      input.settings.promotions.freeShipping,
    )
  }
  const total = Math.max(0, subtotal - discount + Math.max(0, shipping))
  return {
    subtotal,
    discount,
    shipping,
    total,
    appliedCode: promo && (promo.vendorEntityId ? eligible > 0 : true) ? promo.code : null,
  }
}

export function mergeStoreSettings(raw: unknown): StoreSettingsData {
  const source = raw && typeof raw === 'object' ? (raw as Partial<StoreSettingsData>) : {}
  const shipping = source.shipping || ({} as Partial<StoreShippingSettings>)
  const promotions = source.promotions || ({} as Partial<StorePromotionsSettings>)
  return {
    shipping: {
      novaPost: { ...DEFAULT_STORE_SETTINGS.shipping.novaPost, ...(shipping.novaPost || {}) },
      pickup: { ...DEFAULT_STORE_SETTINGS.shipping.pickup, ...(shipping.pickup || {}) },
      defaultMethod:
        shipping.defaultMethod === 'pickup' || shipping.defaultMethod === 'nova-post'
          ? shipping.defaultMethod
          : DEFAULT_STORE_SETTINGS.shipping.defaultMethod,
    },
    promotions: {
      promoCodes: Array.isArray(promotions.promoCodes)
        ? promotions.promoCodes.filter((row) => row && typeof row.code === 'string')
        : DEFAULT_STORE_SETTINGS.promotions.promoCodes,
      freeShipping: {
        ...DEFAULT_STORE_SETTINGS.promotions.freeShipping,
        ...(promotions.freeShipping || {}),
      },
      checkoutSpecialOfferEnabled: Boolean(promotions.checkoutSpecialOfferEnabled),
    },
    referralCommissionPercent:
      typeof source.referralCommissionPercent === 'number' && !Number.isNaN(source.referralCommissionPercent)
        ? source.referralCommissionPercent
        : undefined,
  }
}
