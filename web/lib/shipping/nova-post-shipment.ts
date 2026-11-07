import { promises as fs } from 'node:fs'
import path from 'node:path'

import { db } from '@/lib/database'
import {
  getNovaPostJwt,
  isNovaPostEnabled,
  isNovaPostShipmentsEnabled,
  novaPostApiKey,
  novaPostSend,
} from '@/lib/shipping/nova-post'
import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'
import { getFulfillmentWarehouse, listFulfillmentWarehouses } from '@/features/store/services/warehouse-fulfillment'
import {
  isStaleShipmentIntent,
  novaPostClientOrder,
  parcelForGroup,
  readCarrierShipment,
  readOrderShipments,
  redactCarrierError,
  redactShipmentFixture,
  shipmentDocumentMap,
  warehouseIdsForShipment,
  type ShipmentLineRef,
  type StoredWarehouseShipment,
} from '@/features/store/services/fulfillment-ledger'
import { logger } from '@/lib/logger'

export type ShipmentRecord = {
  id?: string
  number?: string
  status?: string
  history?: Array<{ status?: string; date?: string }>
  warehouseId?: string
}

export type ShipmentParcel = {
  weight: number
  length: number
  width: number
  height: number
}

export type ShipmentAlertSummary = {
  stalePending: number
  refused: number
  truncated: boolean
  pending: Array<{ orderId: string; warehouseId: string; at: string }>
  refusedSamples: Array<{ orderId: string; warehouseId: string; detail: string }>
}

const FIXTURE_PATH = path.join(process.cwd(), '__tests__/fixtures/shipping/novapost-create.redacted.json')
const ALERT_PAGE = 200

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function lineRef(raw: unknown): ShipmentLineRef {
  const item = asRecord(raw)
  const nested = asRecord(item.product)
  return {
    fulfillmentWarehouseId: typeof item.fulfillmentWarehouseId === 'string' ? item.fulfillmentWarehouseId : undefined,
    isPreorder: Boolean(item.isPreorder),
    digitalProduct: Boolean(item.digitalProduct || nested.digitalProduct),
    instantDelivery: Boolean(item.instantDelivery || nested.instantDelivery),
  }
}

function captureEnabled(): boolean {
  const flag = process.env.NOVAPOST_CAPTURE_FIXTURE?.trim().toLowerCase()
  return flag === 'true' || flag === '1'
}

async function captureCreateResponse(body: unknown): Promise<void> {
  if (!captureEnabled()) return
  try {
    await fs.mkdir(path.dirname(FIXTURE_PATH), { recursive: true })
    await fs.writeFile(FIXTURE_PATH, `${JSON.stringify(redactShipmentFixture(body), null, 2)}\n`, { flag: 'wx' })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
    if (code === 'EEXIST') return
    logger.warn('[NovaPost] fixture was not saved', { code: code || 'write failed' })
  }
}

async function loadOrder(orderId: string): Promise<Record<string, unknown>> {
  const orderResult = await db().findDocById<Record<string, unknown>>('orders', orderId)
  if (!orderResult.success || !orderResult.data) throw new Error('Order not found')
  return orderResult.data
}

async function writeShipmentMap(
  orderId: string,
  mutate: (map: Record<string, Record<string, unknown>>, order: Record<string, unknown>) => void,
): Promise<void> {
  await db().transaction(async (transaction) => {
    const fresh = await transaction.read('orders', orderId)
    const order = asRecord(fresh?.data)
    const map = shipmentDocumentMap(order)
    mutate(map, order)
    await transaction.update('orders', orderId, { shipments: map })
  })
}

async function shippingFacts(order: Record<string, unknown>, productId: string): Promise<{ weight?: string | null; dimensions?: string | null }> {
  const items = Array.isArray(order.items) ? order.items : []
  for (const raw of items) {
    const item = asRecord(raw)
    const nested = asRecord(item.product)
    const id = String(item.productId || nested.id || '')
    if (!productId || id !== productId) continue
    let shipping = asRecord(nested.shipping)
    if (id) {
      const product = await db().findDocById<Record<string, unknown>>('store_products', id)
      if (product.success && product.data) shipping = asRecord(product.data.shipping)
    }
    return {
      weight: typeof shipping.weight === 'string' ? shipping.weight : null,
      dimensions: typeof shipping.dimensions === 'string' ? shipping.dimensions : null,
    }
  }
  return {}
}

async function parcelForWarehouse(
  order: Record<string, unknown>,
  warehouseId: string,
  stored: StoredWarehouseShipment | undefined,
): Promise<ShipmentParcel> {
  if (stored?.parcel) return stored.parcel
  const items = Array.isArray(order.items) ? order.items : []
  const facts = []
  for (const raw of items) {
    const ref = lineRef(raw)
    if (ref.isPreorder || ref.digitalProduct || ref.instantDelivery) continue
    const id = ref.fulfillmentWarehouseId || ZERO_WAREHOUSE_ID
    if (id !== warehouseId) continue
    const item = asRecord(raw)
    const nested = asRecord(item.product)
    facts.push(await shippingFacts(order, String(item.productId || nested.id || '')))
  }
  const decision = parcelForGroup(facts)
  if (!decision.parcel) {
    throw new Error('Confirm parcel weight and size before shipping. Leave the status unchanged.')
  }
  return decision.parcel
}

function recordFor(order: Record<string, unknown>, warehouseId: string): StoredWarehouseShipment | undefined {
  return readOrderShipments(order).find((record) => record.warehouseId === warehouseId)
}

export async function ensureNovaPostShipment(orderId: string): Promise<ShipmentRecord | null> {
  const order = await loadOrder(orderId)
  const shipping = asRecord(order.shippingInfo)
  const method = String(shipping.method || '')
  if (method !== 'nova-post') return null

  if (!isNovaPostShipmentsEnabled()) {
    throw new Error('Nova Post shipments are disabled. Leave the status unchanged.')
  }
  if (!isNovaPostEnabled()) throw new Error('Nova Post API key is not configured')

  const items = Array.isArray(order.items) ? order.items : []
  const warehouseIds = warehouseIdsForShipment(items.map(lineRef))
  if (warehouseIds.length === 0) return null

  const location = asRecord(shipping.location)
  const divisionId = String(location.id || location.externalId || '')
  const settlementId = String(location.settlementId || '')
  if (!divisionId || !settlementId) {
    throw new Error('This order has no Nova Post settlement and branch. Leave the status unchanged.')
  }
  const phone = String(shipping.phone || '').trim()
  if (!phone) {
    throw new Error('This order has no recipient phone. Leave the status unchanged.')
  }

  const warehouses = await listFulfillmentWarehouses()
  const orderedIds = [...warehouseIds].sort((a, b) => {
    const left = warehouses.find((row) => row.id === a)?.code || a
    const right = warehouses.find((row) => row.id === b)?.code || b
    return left.localeCompare(right)
  })

  for (const warehouseId of orderedIds) {
    const warehouse = await getFulfillmentWarehouse(warehouseId)
    const name = warehouse?.name || warehouseId
    if (!warehouse?.novaPostSenderDivisionId) {
      throw new Error(`Set the sender Nova Post branch on ${name} before shipping.`)
    }
    const senderPhone = String(warehouse.senderPhone || '').trim()
    if (!senderPhone || warehouse.canShip !== true) {
      throw new Error(`Set the sender phone and can-ship flag on ${name} before shipping.`)
    }
  }

  const parcels = new Map<string, ShipmentParcel>()
  for (const warehouseId of orderedIds) {
    const current = recordFor(order, warehouseId)
    parcels.set(warehouseId, await parcelForWarehouse(order, warehouseId, current))
  }

  const apiKey = novaPostApiKey()
  if (!apiKey) throw new Error('Nova Post API key is not configured')
  const jwt = await getNovaPostJwt(apiKey)
  const name = `${String(shipping.firstName || '')} ${String(shipping.lastName || '')}`.trim() || 'Recipient'
  let first: ShipmentRecord | null = null

  for (const warehouseId of orderedIds) {
    const fresh = await loadOrder(orderId)
    const current = recordFor(fresh, warehouseId)
    if (current?.number) {
      first = first || { id: current.id, number: current.number, status: current.status, warehouseId }
      continue
    }
    if (current?.intent?.status === 'pending') {
      throw new Error('A shipment may already exist at Nova Post. Reconcile it before retrying. Leave the status unchanged.')
    }

    const warehouse = await getFulfillmentWarehouse(warehouseId)
    const senderPhone = String(warehouse?.senderPhone || '').trim()
    const parcel = parcels.get(warehouseId)
    if (!warehouse?.novaPostSenderDivisionId || !senderPhone || !parcel) {
      throw new Error('Set the sender phone and can-ship flag on the fulfilling warehouse before shipping.')
    }

    const claim = await db().transaction(async (transaction) => {
      const locked = await transaction.read('orders', orderId)
      const lockedOrder = asRecord(locked?.data)
      const map = shipmentDocumentMap(lockedOrder)
      const row = asRecord(map[warehouseId])
      if (typeof row.number === 'string' && row.number) return 'exists' as const
      if (asRecord(row.intent).status === 'pending') return 'pending' as const
      map[warehouseId] = {
        ...row,
        warehouseId,
        parcel,
        intent: { status: 'pending', at: new Date().toISOString() },
      }
      await transaction.update('orders', orderId, { shipments: map })
      return 'claimed' as const
    })
    if (claim === 'exists') {
      const again = await loadOrder(orderId)
      const stored = recordFor(again, warehouseId)
      if (stored?.number) {
        first = first || { id: stored.id, number: stored.number, status: stored.status, warehouseId }
        continue
      }
      throw new Error('A shipment may already exist at Nova Post. Reconcile it before retrying. Leave the status unchanged.')
    }
    if (claim === 'pending') {
      throw new Error('A shipment may already exist at Nova Post. Reconcile it before retrying. Leave the status unchanged.')
    }

    let response: Awaited<ReturnType<typeof novaPostSend>>
    try {
      response = await novaPostSend('POST', '/shipments', jwt, {
        payerType: 'Recipient',
        parcels: [{
          weight: parcel.weight,
          length: parcel.length,
          width: parcel.width,
          height: parcel.height,
          rowNumber: 1,
        }],
        sender: { divisionId: warehouse.novaPostSenderDivisionId, name: warehouse.name, phone: senderPhone },
        recipient: { divisionId, settlementId, name, phone },
        clientOrder: novaPostClientOrder(orderId, warehouseId),
      })
    } catch (error) {
      logger.warn('[NovaPost] shipment request did not finish', {
        orderId,
        warehouseId,
        error: redactCarrierError(error instanceof Error ? error.message : 'request failed'),
      })
      throw new Error('Nova Post did not answer. Leave the status unchanged and reconcile before retrying.')
    }
    if (!response.ok) {
      const carrier = asRecord(response.json).message || asRecord(response.json).error || ''
      const detail = redactCarrierError(String(carrier))
      await writeShipmentMap(orderId, (map) => {
        const row = asRecord(map[warehouseId])
        map[warehouseId] = {
          ...row,
          warehouseId,
          intent: { ...asRecord(row.intent), status: 'failed', at: new Date().toISOString(), detail },
        }
      })
      logger.warn('[NovaPost] shipment refused', { orderId, warehouseId, status: response.status, detail })
      throw new Error('Nova Post refused the shipment. Leave the status unchanged.')
    }
    await captureCreateResponse(response.json)
    const shipment = readCarrierShipment(response.json)
    if (!shipment.number && !shipment.id) {
      logger.warn('[NovaPost] shipment response had no number', { orderId, warehouseId })
      throw new Error('Nova Post did not return a shipment number. Leave the status unchanged.')
    }
    await writeShipmentMap(orderId, (map) => {
      const row = asRecord(map[warehouseId])
      map[warehouseId] = {
        ...row,
        warehouseId,
        id: shipment.id,
        number: shipment.number,
        status: shipment.status,
        createdAt: new Date().toISOString(),
        parcel,
        intent: { status: 'accepted', at: new Date().toISOString() },
      }
    })
    first = first || { ...shipment, warehouseId }
  }
  return first
}

export async function refreshNovaPostTracking(orderId: string): Promise<ShipmentRecord[]> {
  const order = await loadOrder(orderId)
  const records = readOrderShipments(order).filter((record) => record.number)
  if (records.length === 0) throw new Error('This order has no shipment number')
  const apiKey = novaPostApiKey()
  if (!apiKey) throw new Error('Nova Post API key is not configured')
  const jwt = await getNovaPostJwt(apiKey)
  const updated: ShipmentRecord[] = []
  for (const record of records) {
    const number = record.number || ''
    const response = await novaPostSend('GET', `/shipments/tracking?numbers[]=${encodeURIComponent(number)}`, jwt)
    if (!response.ok) throw new Error('Nova Post refused the tracking request. Leave the status unchanged.')
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
    const status = String(row.status || history[0]?.status || record.status || '')
    await writeShipmentMap(orderId, (map) => {
      const current = asRecord(map[record.warehouseId])
      map[record.warehouseId] = {
        ...current,
        warehouseId: record.warehouseId,
        status,
        history,
        trackedAt: new Date().toISOString(),
      }
    })
    updated.push({ id: record.id, number, status, history, warehouseId: record.warehouseId })
  }
  return updated
}

export async function scanShipmentAlerts(now = Date.now()): Promise<ShipmentAlertSummary> {
  const summary: ShipmentAlertSummary = {
    stalePending: 0,
    refused: 0,
    truncated: false,
    pending: [],
    refusedSamples: [],
  }
  for (const status of ['new', 'paid', 'processing'] as const) {
    const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'orders',
      filters: [{ field: 'status', operator: '=', value: status }],
      orderBy: [{ field: 'updated_at', direction: 'desc' }],
      pagination: { limit: ALERT_PAGE },
    })
    const rows = result.success && result.data ? result.data : []
    if (rows.length >= ALERT_PAGE) summary.truncated = true
    for (const row of rows) {
      for (const record of readOrderShipments(row)) {
        if (record.number) continue
        const intent = record.intent
        if (intent?.status === 'pending' && isStaleShipmentIntent(intent.at, now)) {
          summary.stalePending += 1
          if (summary.pending.length < 10) {
            summary.pending.push({
              orderId: row.id,
              warehouseId: record.warehouseId,
              at: intent.at || '',
            })
          }
        }
        if (intent?.status === 'failed' && intent.reconciled !== true) {
          summary.refused += 1
          if (intent.detail && summary.refusedSamples.length < 10) {
            summary.refusedSamples.push({
              orderId: row.id,
              warehouseId: record.warehouseId,
              detail: redactCarrierError(intent.detail),
            })
          }
        }
      }
    }
  }
  return summary
}
