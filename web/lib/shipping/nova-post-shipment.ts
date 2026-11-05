import { db } from '@/lib/database'
import { getNovaPostJwt, isNovaPostEnabled, novaPostApiKey, novaPostSend } from '@/lib/shipping/nova-post'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'
import { getFulfillmentWarehouse } from '@/features/store/services/warehouse-fulfillment'

interface ShipmentRecord {
  id?: string
  number?: string
  status?: string
  history?: Array<{ status?: string; date?: string }>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function readShipment(body: unknown): ShipmentRecord {
  const root = asRecord(body)
  const nested = asRecord(root.data || root.item || (Array.isArray(root.items) ? root.items[0] : undefined))
  const source = Object.keys(nested).length ? nested : root
  return {
    id: source.id != null ? String(source.id) : undefined,
    number: typeof source.number === 'string' ? source.number : undefined,
    status: typeof source.status === 'string' ? source.status : undefined,
  }
}

export async function ensureNovaPostShipment(orderId: string): Promise<ShipmentRecord | null> {
  const orderResult = await db().findDocById<Record<string, unknown>>('orders', orderId)
  if (!orderResult.success || !orderResult.data) throw new Error('Order not found')
  const order = orderResult.data
  const shipping = asRecord(order.shippingInfo)
  const method = String(shipping.method || '')
  if (method !== 'nova-post') return null

  const existing = asRecord(order.shipment)
  if (typeof existing.number === 'string' && existing.number) {
    return { id: existing.id ? String(existing.id) : undefined, number: existing.number, status: String(existing.status || '') }
  }
  if (!isNovaPostEnabled()) throw new Error('Nova Post API key is not configured')

  const location = asRecord(shipping.location)
  const divisionId = String(location.id || location.externalId || '')
  const settlementId = String(location.settlementId || '')
  if (!divisionId || !settlementId) {
    throw new Error('This order has no Nova Post settlement and branch. Leave the status unchanged.')
  }

  const items = Array.isArray(order.items) ? order.items : []
  const first = asRecord(items[0])
  const warehouseId = String(first.fulfillmentWarehouseId || ZERO_WAREHOUSE_ID)
  const warehouse = await getFulfillmentWarehouse(warehouseId)
  if (!warehouse.novaPostSenderDivisionId) {
    throw new Error('Set the sender Nova Post branch on the fulfilling warehouse before shipping.')
  }

  const apiKey = novaPostApiKey()
  if (!apiKey) throw new Error('Nova Post API key is not configured')
  const jwt = await getNovaPostJwt(apiKey)
  const phone = String(shipping.phone || '')
  const name = `${String(shipping.firstName || '')} ${String(shipping.lastName || '')}`.trim() || 'Recipient'
  const response = await novaPostSend('POST', '/shipments', jwt, {
    payerType: 'Recipient',
    parcels: [{ weight: 1, length: 20, width: 20, height: 10, rowNumber: 1 }],
    sender: { divisionId: warehouse.novaPostSenderDivisionId, name: warehouse.name, phone: phone || '380000000000' },
    recipient: { divisionId, settlementId, name, phone: phone || '380000000000' },
    clientOrder: orderId,
  })
  if (!response.ok) {
    const message = asRecord(response.json).message || asRecord(response.json).error || `Nova Post HTTP ${response.status}`
    throw new Error(String(message))
  }
  const shipment = readShipment(response.json)
  if (!shipment.number && !shipment.id) throw new Error('Nova Post did not return a shipment number')
  const saved = await db().updateDoc('orders', orderId, {
    shipment: { ...shipment, createdAt: new Date().toISOString() },
  })
  if (!saved.success) throw saved.error || new Error('Failed to store the shipment')
  return shipment
}

export async function refreshNovaPostTracking(orderId: string): Promise<ShipmentRecord> {
  const orderResult = await db().findDocById<Record<string, unknown>>('orders', orderId)
  if (!orderResult.success || !orderResult.data) throw new Error('Order not found')
  const shipment = asRecord(orderResult.data.shipment)
  const number = typeof shipment.number === 'string' ? shipment.number : ''
  if (!number) throw new Error('This order has no shipment number')
  const apiKey = novaPostApiKey()
  if (!apiKey) throw new Error('Nova Post API key is not configured')
  const jwt = await getNovaPostJwt(apiKey)
  const response = await novaPostSend('GET', `/shipments/tracking?numbers[]=${encodeURIComponent(number)}`, jwt)
  if (!response.ok) throw new Error(`Nova Post HTTP ${response.status}`)
  const body = asRecord(response.json)
  const row = asRecord(Array.isArray(body.items) ? body.items[0] : body.data || body)
  const historyRaw = Array.isArray(row.tracking) ? row.tracking : Array.isArray(row.history) ? row.history : []
  const history = historyRaw.slice(0, 12).map((entry) => {
    const item = asRecord(entry)
    return {
      status: String(item.status || item.code || item.description || ''),
      date: String(item.date || item.tracking_update_date || ''),
    }
  })
  const status = String(row.status || history[0]?.status || shipment.status || '')
  await db().updateDoc('orders', orderId, {
    shipment: { ...shipment, status, history, trackedAt: new Date().toISOString() },
  })
  return { id: shipment.id ? String(shipment.id) : undefined, number, status, history }
}
