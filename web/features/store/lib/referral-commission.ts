import { DEFAULT_COMMISSION_STRUCTURE } from '@/constants/store'
import type { CommissionStructure } from '@/features/store/types'
import type { MerchantConfiguration } from '@/features/store/types/vendor'
import type { CartItem, OrderItem } from '@/features/store/types'

export type ReferralCommissionSource = 'product' | 'merchant' | 'default' | 'env'

export interface ReferralCommissionProductInput {
  referralCommission?: number
  commissionStructure?: Pick<CommissionStructure, 'referralCommission'>
}

export interface ResolvedReferralCommission {
  percent: number
  source: ReferralCommissionSource
}

export interface ReferralItemRate {
  productId: string
  percent: number
  source: ReferralCommissionSource
  subtotal: number
  amount: number
}

export interface WeightedReferralCommission {
  amount: number
  effectivePercent: number
  itemRates: ReferralItemRate[]
}

const DEFAULT_MAX_PERCENT = 50

export function getReferralCommissionMaxPercent(): number {
  const fromEnv = Number(process.env.REFERRAL_COMMISSION_MAX_PERCENT)
  if (!Number.isNaN(fromEnv) && fromEnv > 0) {
    return fromEnv
  }
  return DEFAULT_MAX_PERCENT
}

export function clampReferralPercent(value: number): number {
  const max = getReferralCommissionMaxPercent()
  if (Number.isNaN(value)) return 0
  return Math.min(max, Math.max(0, value))
}

/** Platform default when no product/merchant override applies. */
export function getPlatformDefaultReferralPercent(): number {
  const fromConstant = DEFAULT_COMMISSION_STRUCTURE.referralCommission
  if (typeof fromConstant === 'number' && !Number.isNaN(fromConstant)) {
    return clampReferralPercent(fromConstant)
  }

  const fromEnv = Number(process.env.REFERRAL_REWARD_PERCENT || '5')
  return clampReferralPercent(fromEnv)
}

export function normalizeProductReferralInput(
  raw: Record<string, unknown> | null | undefined,
): ReferralCommissionProductInput | undefined {
  if (!raw) return undefined

  const data = raw as Record<string, unknown>
  const nested = (data.commissionStructure ?? raw.commissionStructure) as
    | CommissionStructure
    | undefined

  const direct =
    (raw.referralCommission as number | undefined) ??
    (data.referralCommission as number | undefined) ??
    nested?.referralCommission

  if (direct === undefined && !nested?.referralCommission) {
    return nested ? { commissionStructure: nested } : undefined
  }

  return {
    referralCommission: direct,
    commissionStructure: nested,
  }
}

/**
 * Resolution hierarchy:
 * product.referralCommission → product.commissionStructure.referralCommission
 * → merchantConfig.commissionStructure.referralCommission
 * → DEFAULT_COMMISSION_STRUCTURE.referralCommission → REFERRAL_REWARD_PERCENT env
 */
export function resolveReferralCommissionPercent(
  product?: ReferralCommissionProductInput | null,
  merchantConfig?: MerchantConfiguration | null,
): ResolvedReferralCommission {
  const productDirect = product?.referralCommission
  if (productDirect !== undefined && productDirect !== null && !Number.isNaN(productDirect)) {
    return { percent: clampReferralPercent(productDirect), source: 'product' }
  }

  const productNested = product?.commissionStructure?.referralCommission
  if (productNested !== undefined && productNested !== null && !Number.isNaN(productNested)) {
    return { percent: clampReferralPercent(productNested), source: 'product' }
  }

  const merchantRate = merchantConfig?.commissionStructure?.referralCommission
  if (merchantRate !== undefined && merchantRate !== null && !Number.isNaN(merchantRate)) {
    return { percent: clampReferralPercent(merchantRate), source: 'merchant' }
  }

  const constantDefault = DEFAULT_COMMISSION_STRUCTURE.referralCommission
  if (constantDefault !== undefined && constantDefault !== null && !Number.isNaN(constantDefault)) {
    return { percent: clampReferralPercent(constantDefault), source: 'default' }
  }

  const envDefault = Number(process.env.REFERRAL_REWARD_PERCENT || '5')
  return {
    percent: clampReferralPercent(envDefault),
    source: 'env',
  }
}

function lineSubtotalFromOrderItem(item: OrderItem): number {
  const unit = parseFloat(String(item.price))
  if (Number.isNaN(unit)) return 0
  return unit * item.quantity
}

function lineSubtotalFromCartItem(item: CartItem): number {
  const unit =
    item.finalPrice ??
    parseFloat(String(item.product?.price ?? '0'))
  if (Number.isNaN(unit)) return 0
  return unit * item.quantity
}

export function computeWeightedReferralCommissionFromOrderItems(
  items: OrderItem[],
  hasReferralCode: boolean,
  merchantConfig?: MerchantConfiguration | null,
  productsById?: Map<string, ReferralCommissionProductInput>,
): WeightedReferralCommission {
  if (!hasReferralCode || items.length === 0) {
    return { amount: 0, effectivePercent: 0, itemRates: [] }
  }

  let totalSubtotal = 0
  let totalReferral = 0
  const itemRates: ReferralItemRate[] = []

  for (const item of items) {
    const subtotal = lineSubtotalFromOrderItem(item)
    if (subtotal <= 0) continue

    const product = productsById?.get(item.productId)
    const resolved = resolveReferralCommissionPercent(product, merchantConfig)
    const amount = (subtotal * resolved.percent) / 100

    totalSubtotal += subtotal
    totalReferral += amount
    itemRates.push({
      productId: item.productId,
      percent: resolved.percent,
      source: resolved.source,
      subtotal,
      amount,
    })
  }

  const effectivePercent =
    totalSubtotal > 0 ? (totalReferral / totalSubtotal) * 100 : getPlatformDefaultReferralPercent()

  return {
    amount: totalReferral,
    effectivePercent,
    itemRates,
  }
}

export function computeWeightedReferralPercentFromCart(
  items: CartItem[],
  merchantConfigByEntityId?: Map<string, MerchantConfiguration>,
  fallbackMerchantConfig?: MerchantConfiguration | null,
  productsById?: Map<string, ReferralCommissionProductInput>,
): number {
  if (!items.length) {
    return getPlatformDefaultReferralPercent()
  }

  let totalSubtotal = 0
  let totalReferral = 0

  for (const item of items) {
    const subtotal = lineSubtotalFromCartItem(item)
    if (subtotal <= 0) continue

    const entityId = item.product?.ownerEntityId
    const merchantConfig =
      (entityId && merchantConfigByEntityId?.get(entityId)) || fallbackMerchantConfig

    // Prefer DB-loaded product data over the cart snapshot — checkout payloads
    // often serialize a minimal product object without commission fields.
    const productInput: ReferralCommissionProductInput =
      (item.product?.id && productsById?.get(item.product.id)) || {
        referralCommission: item.product?.referralCommission,
        commissionStructure: item.product?.commissionStructure,
      }
    const resolved = resolveReferralCommissionPercent(productInput, merchantConfig)
    totalSubtotal += subtotal
    totalReferral += (subtotal * resolved.percent) / 100
  }

  if (totalSubtotal <= 0) {
    return getPlatformDefaultReferralPercent()
  }

  return (totalReferral / totalSubtotal) * 100
}

/** Load referral-commission inputs for product ids from the database. */
export async function loadReferralProductInputs(
  productIds: string[],
  deps: {
    findById: (collection: string, id: string) => Promise<{ success: boolean; data?: any }>
  },
): Promise<Map<string, ReferralCommissionProductInput>> {
  const productsById = new Map<string, ReferralCommissionProductInput>()
  for (const productId of [...new Set(productIds.filter(Boolean))]) {
    const result = await deps.findById('store_products', productId)
    if (!result.success || !result.data) continue
    const raw = result.data as Record<string, unknown>
    const normalized = normalizeProductReferralInput(raw)
    if (normalized) productsById.set(productId, normalized)
  }
  return productsById
}
