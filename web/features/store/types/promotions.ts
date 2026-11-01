/**
 * Store promotions SSOT types.
 *
 * Persistence:
 * - Per-vendor settings → vendor_profiles.data.promotions (DB JSONB)
 * - Per-product offers → products/store_products.data.promotions (DB JSONB)
 * - Allowed types / defaults / feature flags → ring-config.store.promotions
 */

import type { StorePaymentMethods } from '@/features/store/types'

/** Free-shipping modes for a vendor storefront. */
export type FreeShippingMode = 'off' | 'always' | 'conditional'

export interface VendorFreeShippingPromotion {
  mode: FreeShippingMode
  /**
   * Minimum cart subtotal (in `currency`) required when mode === 'conditional'.
   * Ignored for 'off' / 'always'.
   */
  minOrderAmount?: number
  /** Store display/settlement currency for the threshold (defaults to store.mainCurrency). */
  currency?: StorePaymentMethods | string
}

/**
 * Vendor-level promotions (dashboard → checkout UX).
 * Kept on VendorProfile.promotions in DB — NOT in ring-config.
 */
export interface VendorStorePromotions {
  /**
   * When true, checkout may show the Special Offer modal for this seller's cart.
   * Modal copy may still describe free shipping; actual shipping cost uses `freeShipping`.
   */
  checkoutSpecialOfferEnabled?: boolean
  /** Free shipping policy for this vendor's products. */
  freeShipping?: VendorFreeShippingPromotion
  /** Promo codes owned by this vendor. Platform codes stay on platform_settings. */
  promoCodes?: StorePromoCode[]
  /** Optional Nova Post / pickup overrides for this vendor's own checkout. */
  shipping?: import('./store-settings').StoreShippingSettings
}

export type ProductPromotionType =
  | 'bogo' // buy N get M free
  | 'percent_off'
  | 'amount_off'

/**
 * Single product-level promotion (product CRUD).
 * Stored on product JSONB as `promotions: ProductPromotion[]`.
 */
export interface ProductPromotion {
  id: string
  type: ProductPromotionType
  enabled: boolean
  label?: string
  /** BOGO: buy this many paid units */
  buyQty?: number
  /** BOGO: get this many free */
  getQty?: number
  /** percent_off: 1–100 */
  percentOff?: number
  /** amount_off: fixed discount per unit (or line — see apply helper) */
  amountOff?: number
  currency?: StorePaymentMethods | string
  startsAt?: string
  endsAt?: string
}

/** ring-config.store.promotions catalog (feature/SSOT defaults only). */
export interface StorePromotionsConfig {
  /** Enable Special Offer modal feature empire-wide (vendors still opt in via DB). */
  specialOfferModalEnabled?: boolean
  /** Allowed product promotion types for CRUD UI. */
  allowedProductPromotionTypes?: ProductPromotionType[]
  /** Default free-shipping mode suggested on new vendor profiles. */
  defaultFreeShippingMode?: FreeShippingMode
  /** Default conditional threshold in store.mainCurrency. */
  defaultFreeShippingMinOrderAmount?: number
}

function parsePromoBoundary(value: string, bound: 'start' | 'end'): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T${bound === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`)
  }
  return new Date(value)
}

export function isPromotionActive(promo: ProductPromotion, now = new Date()): boolean {
  if (!promo.enabled) return false
  if (promo.startsAt && parsePromoBoundary(promo.startsAt, 'start') > now) return false
  if (promo.endsAt && parsePromoBoundary(promo.endsAt, 'end') < now) return false
  return true
}

export function formatPromotionBadge(promo: ProductPromotion): string {
  if (promo.label?.trim()) return promo.label.trim()
  if (promo.type === 'bogo') return `${promo.buyQty ?? 2}+${promo.getQty ?? 1}`
  if (promo.type === 'percent_off' && typeof promo.percentOff === 'number') {
    return `-${promo.percentOff}%`
  }
  if (promo.type === 'amount_off' && typeof promo.amountOff === 'number') {
    return `-${promo.amountOff} ${promo.currency || ''}`.trim()
  }
  return promo.type
}

/**
 * Payable quantity after BOGO (e.g. buy 2 get 1 → for qty 3 pay for 2).
 */
export function bogoPayableQuantity(quantity: number, buyQty = 2, getQty = 1): number {
  const buy = Math.max(1, Math.floor(buyQty))
  const get = Math.max(1, Math.floor(getQty))
  const cycle = buy + get
  if (quantity <= 0 || cycle <= 0) return Math.max(0, quantity)
  const cycles = Math.floor(quantity / cycle)
  const remainder = quantity % cycle
  return cycles * buy + Math.min(remainder, buy)
}

/**
 * Unit/line effective price after the first active product promotion.
 * `unitPrice` is already in the display currency.
 */
export function applyProductPromotionToLine(
  unitPrice: number,
  quantity: number,
  promotions: ProductPromotion[] | undefined,
): { quantityPayable: number; lineTotal: number; applied?: ProductPromotion } {
  const active = (promotions || []).find((p) => isPromotionActive(p))
  if (!active || quantity <= 0) {
    return { quantityPayable: quantity, lineTotal: unitPrice * quantity }
  }

  if (active.type === 'bogo') {
    const payable = bogoPayableQuantity(quantity, active.buyQty ?? 2, active.getQty ?? 1)
    return { quantityPayable: payable, lineTotal: unitPrice * payable, applied: active }
  }

  if (active.type === 'percent_off' && typeof active.percentOff === 'number') {
    const pct = Math.min(100, Math.max(0, active.percentOff))
    const discounted = unitPrice * (1 - pct / 100)
    return { quantityPayable: quantity, lineTotal: discounted * quantity, applied: active }
  }

  if (active.type === 'amount_off' && typeof active.amountOff === 'number') {
    const discounted = Math.max(0, unitPrice - active.amountOff)
    return { quantityPayable: quantity, lineTotal: discounted * quantity, applied: active }
  }

  return { quantityPayable: quantity, lineTotal: unitPrice * quantity }
}

/**
 * Whether free shipping applies for a vendor given cart subtotal in the vendor's threshold currency.
 */
export function isVendorFreeShippingQualified(
  promotions: VendorStorePromotions | undefined,
  subtotalInThresholdCurrency: number,
): boolean {
  const fs = promotions?.freeShipping
  if (!fs || fs.mode === 'off') {
    // Legacy: modal toggle alone used to imply free shipping messaging
    return Boolean(promotions?.checkoutSpecialOfferEnabled)
  }
  if (fs.mode === 'always') return true
  const min = typeof fs.minOrderAmount === 'number' ? fs.minOrderAmount : 0
  return subtotalInThresholdCurrency >= min
}

export type StorePromoDiscountType = 'percent' | 'fixed'

export interface StorePromoCode {
  id: string
  code: string
  discountType: StorePromoDiscountType
  /** Percent 1–100, or a fixed amount in the store main currency. */
  value: number
  minOrderAmount?: number
  startsAt?: string
  endsAt?: string
  enabled: boolean
  description?: string
  /** When set, the code discounts only this vendor's lines. Empty means platform-wide. */
  vendorEntityId?: string | null
  /** Optional cap. 0 or omitted means unlimited. */
  maxRedemptions?: number
  /** Optional per-buyer cap. 0 or omitted means unlimited per buyer. */
  maxUsesPerUser?: number
  redemptionCount?: number
}

export function isStorePromoCodeActive(promo: StorePromoCode, now = new Date()): boolean {
  if (!promo.enabled || !promo.code.trim()) return false
  if (promo.startsAt && parsePromoBoundary(promo.startsAt, 'start') > now) return false
  if (promo.endsAt && parsePromoBoundary(promo.endsAt, 'end') < now) return false
  if (
    typeof promo.maxRedemptions === 'number' &&
    promo.maxRedemptions > 0 &&
    (promo.redemptionCount ?? 0) >= promo.maxRedemptions
  ) {
    return false
  }
  return true
}

export function findStorePromoCode(
  codes: StorePromoCode[] | undefined,
  rawCode: string,
  now = new Date(),
): StorePromoCode | undefined {
  const needle = rawCode.trim().toLowerCase()
  if (!needle) return undefined
  return (codes || []).find(
    (promo) => promo.code.trim().toLowerCase() === needle && isStorePromoCodeActive(promo, now),
  )
}

/** Discount amount in the same currency as `subtotal`. Never exceeds the subtotal. */
export function computePromoCodeDiscount(subtotal: number, promo: StorePromoCode | null | undefined): number {
  if (!promo || subtotal <= 0) return 0
  const min = typeof promo.minOrderAmount === 'number' ? promo.minOrderAmount : 0
  if (subtotal < min) return 0
  if (promo.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, promo.value))
    return Math.min(subtotal, (subtotal * pct) / 100)
  }
  return Math.min(subtotal, Math.max(0, promo.value))
}
