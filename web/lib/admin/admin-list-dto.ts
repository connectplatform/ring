/**
 * Admin list DTO helpers — keep RSC→client props plain JSON (no Date / fat blobs).
 */

import { readOrderShipments, redactCarrierError, warehouseIdsForShipment } from '@/features/store/services/fulfillment-ledger'

export const ADMIN_LIST_PAGE_SIZE = 50

export function toIsoString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
  }
  return undefined
}

export function toIsoStringRequired(value: unknown, fallback = new Date(0).toISOString()): string {
  return toIsoString(value) ?? fallback
}

export interface AdminOrderItemDto {
  name?: string
  productId?: string
  quantity?: number
  price?: string
  currency?: string
  fulfillmentWarehouseId?: string
  returnable?: number
}

export interface AdminWarehouseShipmentDto {
  warehouseId: string
  number?: string
  status?: string
  history?: Array<{ status?: string; date?: string }>
  intentStatus?: string
  intentAt?: string
  intentDetail?: string
  parcel?: { weight: number; length: number; width: number; height: number }
  needsParcel: boolean
}

export interface AdminOrderShipmentDto {
  id?: string
  number?: string
  status?: string
  history?: Array<{ status?: string; date?: string }>
}

export interface AdminOrderDto {
  id: string
  status?: string
  userId?: string
  createdAt?: string
  items?: AdminOrderItemDto[]
  subtotal?: number
  discountAmount?: number
  shippingCost?: number
  promoCode?: string
  total?: number
  currency?: string
  paymentStatus?: string
  shippingMethod?: string
  shippingBranch?: string
  shippingSettlementId?: string
  shippingDivisionId?: string
  shipmentParcel?: { weight: number; length: number; width: number; height: number }
  shipmentIntentStatus?: string
  shipment?: AdminOrderShipmentDto
  shipments?: AdminWarehouseShipmentDto[]
}

export function toAdminOrderDto(row: Record<string, unknown> & { id: string }): AdminOrderDto {
  const rawItems = Array.isArray(row.items) ? row.items : []
  const items: AdminOrderItemDto[] = rawItems.map((item) => {
    const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const product = entry.product && typeof entry.product === 'object' ? (entry.product as Record<string, unknown>) : {}
    return {
      name: entry.name != null ? String(entry.name) : undefined,
      productId: entry.productId != null ? String(entry.productId) : product.id != null ? String(product.id) : undefined,
      quantity: typeof entry.quantity === 'number' ? entry.quantity : Number(entry.quantity) || undefined,
      price: entry.price != null ? String(entry.price) : undefined,
      currency: entry.currency != null ? String(entry.currency) : undefined,
      fulfillmentWarehouseId:
        entry.fulfillmentWarehouseId != null ? String(entry.fulfillmentWarehouseId) : undefined,
    }
  })

  const rawStatus = row.status != null ? String(row.status) : undefined
  // SalesBox imports used British "cancelled"; Ring UI/status SSOT is "canceled"
  const status = rawStatus === 'cancelled' ? 'canceled' : rawStatus

  const base = {
    id: String(row.id),
    status,
    userId: row.userId != null ? String(row.userId) : undefined,
    createdAt: toIsoString(row.createdAt ?? row.created_at),
    items,
    subtotal: typeof row.subtotal === 'number' ? row.subtotal : undefined,
    discountAmount: typeof row.discountAmount === 'number' ? row.discountAmount : undefined,
    shippingCost: typeof row.shippingCost === 'number' ? row.shippingCost : undefined,
    promoCode: row.promoCode != null ? String(row.promoCode) : undefined,
    total: typeof row.total === 'number' ? row.total : undefined,
    currency: row.currency != null ? String(row.currency) : undefined,
    paymentStatus:
      row.payment && typeof row.payment === 'object' && (row.payment as { status?: unknown }).status != null
        ? String((row.payment as { status?: unknown }).status)
        : undefined,
    shippingMethod:
      row.shippingInfo && typeof row.shippingInfo === 'object'
        ? String((row.shippingInfo as { method?: unknown }).method || '')
        : undefined,
    shippingBranch:
      row.shippingInfo && typeof row.shippingInfo === 'object'
        ? String(
            ((row.shippingInfo as { location?: { name?: unknown } }).location || {}).name ||
              (row.shippingInfo as { address?: unknown }).address ||
              '',
          )
        : undefined,
    shippingSettlementId:
      row.shippingInfo && typeof row.shippingInfo === 'object'
        ? String(
            ((row.shippingInfo as { location?: { settlementId?: unknown } }).location || {}).settlementId || '',
          )
        : undefined,
    shippingDivisionId:
      row.shippingInfo && typeof row.shippingInfo === 'object'
        ? String(
            ((row.shippingInfo as { location?: { id?: unknown; externalId?: unknown } }).location || {}).id ||
              ((row.shippingInfo as { location?: { externalId?: unknown } }).location || {}).externalId ||
              '',
          )
        : undefined,
    shipmentParcel: (() => {
      const parcel = row.shipmentParcel
      if (!parcel || typeof parcel !== 'object') return undefined
      const record = parcel as { weight?: unknown; length?: unknown; width?: unknown; height?: unknown }
      const weight = Number(record.weight)
      const length = Number(record.length)
      const width = Number(record.width)
      const height = Number(record.height)
      if (![weight, length, width, height].every((value) => Number.isFinite(value) && value > 0)) return undefined
      return { weight, length, width, height }
    })(),
    shipmentIntentStatus: undefined,
    shipment: undefined,
    shipments: [],
  }
  const method = base.shippingMethod || ''
  const stored = readOrderShipments(row)
  const lineIds = warehouseIdsForShipment(
    rawItems.map((raw) => {
      const entry = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const product = entry.product && typeof entry.product === 'object' ? (entry.product as Record<string, unknown>) : {}
      return {
        fulfillmentWarehouseId:
          entry.fulfillmentWarehouseId != null ? String(entry.fulfillmentWarehouseId) : undefined,
        isPreorder: Boolean(entry.isPreorder),
        digitalProduct: Boolean(entry.digitalProduct || product.digitalProduct),
        instantDelivery: Boolean(entry.instantDelivery || product.instantDelivery),
      }
    }),
  )
  const ids = method === 'nova-post'
    ? [...new Set([...stored.map((record) => record.warehouseId), ...lineIds])]
    : stored.filter((record) => record.number || record.intent).map((record) => record.warehouseId)
  const shipments: AdminWarehouseShipmentDto[] = ids.map((warehouseId) => {
    const record = stored.find((row) => row.warehouseId === warehouseId)
    const parcel = record?.parcel
    return {
      warehouseId,
      number: record?.number,
      status: record?.status,
      history: record?.history,
      intentStatus: record?.intent?.status,
      intentAt: record?.intent?.at,
      intentDetail: record?.intent?.detail ? redactCarrierError(record.intent.detail) : undefined,
      parcel: parcel
        ? { weight: parcel.weight, length: parcel.length, width: parcel.width, height: parcel.height }
        : undefined,
      needsParcel: method === 'nova-post' && !record?.number && !parcel,
    }
  })
  const numbered = shipments.find((record) => record.number)
  const pending = shipments.find((record) => record.intentStatus === 'pending')
  return {
    ...base,
    shipmentIntentStatus: pending?.intentStatus || shipments.find((record) => record.intentStatus)?.intentStatus,
    shipment: numbered
      ? { id: undefined, number: numbered.number, status: numbered.status, history: numbered.history }
      : undefined,
    shipments,
  }
}
