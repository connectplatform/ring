/** Buyer orders dashboard readers. Postgres order JSON plus public opportunity rows. */

export type ShipmentSnapshot = {
  number?: string
  status?: string
}

export type OpportunityOffer = {
  id: string
  title: string
  type: string
  conditions: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** First warehouse shipment that already has a waybill or a carrier status. */
export function readBuyerShipment(order: Record<string, unknown>): ShipmentSnapshot | null {
  const shipments = asRecord(order.shipments)
  if (shipments) {
    for (const value of Object.values(shipments)) {
      const row = asRecord(value)
      if (!row) continue
      const number = text(row.number)
      const status = text(row.status)
      if (number || status) return { number, status }
    }
  }
  const legacy = asRecord(order.shipment)
  if (!legacy) return null
  const number = text(legacy.number)
  const status = text(legacy.status)
  if (!number && !status) return null
  return { number, status }
}

function conditionsText(conditions: unknown): string | null {
  if (typeof conditions === 'string' && conditions.trim()) return conditions.trim()
  if (Array.isArray(conditions)) {
    const lines = conditions.map((item) => text(item)).filter((item): item is string => Boolean(item))
    return lines.length ? lines.join(' · ') : null
  }
  const record = asRecord(conditions)
  if (!record) return null
  const lines = Object.values(record).map((item) => text(item)).filter((item): item is string => Boolean(item))
  return lines.length ? lines.join(' · ') : null
}

function promotionConditionsFrom(row: Record<string, unknown>): string | null {
  const vendor = asRecord(row.vendor)
  const promotion = asRecord(vendor?.promotion)
  if (!promotion) return null
  return conditionsText(promotion.conditions)
}

/** `opportunity.vendor.promotion.conditions`, including a nested `data` payload. */
export function readPromotionConditions(opportunity: Record<string, unknown>): string | null {
  return (
    promotionConditionsFrom(opportunity) ||
    promotionConditionsFrom(asRecord(opportunity.data) || {}) ||
    null
  )
}

export function readOpportunityOffer(row: unknown): OpportunityOffer | null {
  const item = asRecord(row)
  if (!item) return null
  const id = text(item.id)
  const title = text(item.title) || text(item.name)
  const type = text(item.type) || ''
  if (!id || !title) return null
  return { id, title, type, conditions: readPromotionConditions(item) }
}
