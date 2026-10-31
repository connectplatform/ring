import { applyProductPromotionToLine, computePromoCodeDiscount, type StorePromoCode } from '@/features/store/types/promotions'
import type { ProductPromotion } from '@/features/store/types/promotions'

export interface PricedCartLine {
  quantity: number
  unitPrice: number
  lineTotal: number
  label?: string
}

export function priceCartLine(
  unitPrice: number,
  quantity: number,
  promotions: ProductPromotion[] | undefined,
): PricedCartLine {
  const priced = applyProductPromotionToLine(unitPrice, quantity, promotions)
  return {
    quantity,
    unitPrice,
    lineTotal: priced.lineTotal,
    label: priced.applied?.label,
  }
}

export function sumLineTotals(lines: Array<{ lineTotal: number }>): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0)
}

export function applyCartAdjustments(input: {
  subtotal: number
  shippingCost: number
  promo: StorePromoCode | null
}): { discount: number; total: number } {
  const discount = computePromoCodeDiscount(input.subtotal, input.promo)
  const total = Math.max(0, input.subtotal - discount + Math.max(0, input.shippingCost))
  return { discount, total }
}

export function cartLineVendorId(product: {
  ownerEntityId?: string
  productOwner?: string
  vendorId?: string
}): string {
  return product.ownerEntityId || product.productOwner || product.vendorId || ''
}

export function sumPromotedLines(
  lines: Array<{ unitPrice: number; quantity: number; promotions?: ProductPromotion[] }>,
): number {
  return lines.reduce((sum, line) => sum + priceCartLine(line.unitPrice, line.quantity, line.promotions).lineTotal, 0)
}
