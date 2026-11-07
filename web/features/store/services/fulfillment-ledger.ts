/**
 * Pure fulfillment rules. No database. Levels stay a locked cache;
 * these helpers decide routing, cost, parcel size, and who may post.
 */

import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'

export type WarehouseAvailability = {
  id: string
  name: string
  code: string
  storeId: string
  active: boolean
  available: number
  isDefault?: boolean
}

export type WarehouseAction =
  | 'view'
  | 'receive'
  | 'transfer'
  | 'adjust'
  | 'damage'
  | 'supplier_payment'
  | 'sender'

const MANAGER_ACTIONS: ReadonlySet<WarehouseAction> = new Set([
  'view',
  'receive',
  'transfer',
  'adjust',
  'damage',
  'supplier_payment',
  'sender',
])

const WORKER_ACTIONS: ReadonlySet<WarehouseAction> = new Set(['view', 'receive', 'transfer'])

export function operatorMay(input: {
  isPlatformAdmin: boolean
  assignmentRole: 'manager' | 'worker' | null
  assignedWarehouseId: string | null
  warehouseId: string
  action: WarehouseAction
}): boolean {
  if (input.isPlatformAdmin) return true
  if (!input.assignmentRole || input.assignedWarehouseId !== input.warehouseId) return false
  if (input.assignmentRole === 'manager') return MANAGER_ACTIONS.has(input.action)
  return WORKER_ACTIONS.has(input.action)
}

/** Unknown cost is missing, non-finite, or zero. It must not pull the average down. */
export function isKnownUnitCost(unitCost: number): boolean {
  return Number.isFinite(unitCost) && unitCost > 0
}

export function movingAverage(onHand: number, oldCost: number, qty: number, unitCost: number): number {
  const incomingKnown = isKnownUnitCost(unitCost)
  const oldKnown = isKnownUnitCost(oldCost)
  if (!incomingKnown) return oldKnown ? oldCost : 0
  if (!oldKnown) return unitCost
  const next = onHand + qty
  if (next <= 0) return unitCost
  return (onHand * oldCost + qty * unitCost) / next
}

export function movementValue(quantity: number, averageCost: number): number {
  if (!isKnownUnitCost(averageCost)) return 0
  return Math.abs(quantity) * averageCost
}

export function refuseSetBelowReserved(setQuantity: number, reserved: number): boolean {
  return setQuantity < reserved
}

export function movementDocId(idempotencyKey?: string): string {
  const key = (idempotencyKey || '').trim()
  if (key) {
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
    if (safe) return safe.startsWith('mov_') ? safe : `mov_${safe}`
  }
  return `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function pickFulfillmentWarehouse(input: {
  quantity: number
  explicitWarehouseId?: string
  warehouses: WarehouseAvailability[]
}): { warehouseId: string; storeId: string } | null {
  const warehouses = input.warehouses.filter((row) => row.active)
  const explicit = input.explicitWarehouseId
    ? warehouses.find((row) => row.id === input.explicitWarehouseId)
    : undefined
  if (explicit) {
    return explicit.available >= input.quantity
      ? { warehouseId: explicit.id, storeId: explicit.storeId }
      : null
  }
  const preferred =
    warehouses.find((row) => row.id === ZERO_WAREHOUSE_ID) || warehouses.find((row) => row.isDefault)
  if (preferred && preferred.available >= input.quantity) {
    return { warehouseId: preferred.id, storeId: preferred.storeId }
  }
  const rest = warehouses
    .filter((row) => row.id !== preferred?.id)
    .sort((a, b) => a.code.localeCompare(b.code))
  const match = rest.find((row) => row.available >= input.quantity)
  if (!match) return null
  return { warehouseId: match.id, storeId: match.storeId }
}

export function formatFulfillmentShortfall(input: {
  requested: number
  rows: Array<{ name: string; code: string; available: number }>
}): { max: number; message: string } {
  const active = input.rows
  const max = active.reduce((highest, row) => Math.max(highest, row.available), 0)
  const named = active
    .map((row) => `${row.name} (${row.code}): ${row.available}`)
    .join(', ')
  const message = named
    ? `One warehouse must cover ${input.requested}. The most any warehouse can ship is ${max}. ${named}. Transfer stock before this quantity can ship.`
    : `One warehouse must cover ${input.requested}. The most any warehouse can ship is ${max}. Transfer stock before this quantity can ship.`
  return { max, message }
}

export function parseShippingWeight(raw?: string | null): number | null {
  if (raw == null) return null
  const match = String(raw).trim().replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export function parseShippingDimensions(
  raw?: string | null,
): { length: number; width: number; height: number } | null {
  if (raw == null) return null
  const parts = String(raw)
    .toLowerCase()
    .split(/[x×*]/)
    .map((part) => Number(part.trim().replace(',', '.').match(/(\d+(?:\.\d+)?)/)?.[1]))
  if (parts.length < 3 || parts.slice(0, 3).some((value) => !Number.isFinite(value) || value <= 0)) {
    return null
  }
  return { length: parts[0], width: parts[1], height: parts[2] }
}

export type ResolvedParcel = {
  weight: number
  length: number
  width: number
  height: number
  source: 'product' | 'confirmed'
}

export function resolveParcelFromLines(
  lines: Array<{ weight?: string | null; dimensions?: string | null }>,
): ResolvedParcel | null {
  if (lines.length !== 1) return null
  const weight = parseShippingWeight(lines[0]?.weight)
  const dimensions = parseShippingDimensions(lines[0]?.dimensions)
  if (weight == null || !dimensions) return null
  return { weight, ...dimensions, source: 'product' }
}

export function redactCarrierError(message: string): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\+?\d[\d\s\-()]{8,}\d/g, '[redacted]')
}

export function readDivisionSettlement(row: unknown): {
  divisionId: string
  settlementId: string
  name: string
  address: string
} | null {
  if (!row || typeof row !== 'object') return null
  const item = row as Record<string, unknown>
  const divisionId = stringField(item, 'id') || stringField(item, 'Ref')
  if (!divisionId) return null
  const settlement = item.settlement && typeof item.settlement === 'object'
    ? (item.settlement as Record<string, unknown>)
    : undefined
  const settlementId =
    stringField(item, 'settlementId') ||
    (settlement ? stringField(settlement, 'id') || stringField(settlement, 'Ref') : '')
  return {
    divisionId,
    settlementId,
    name: stringField(item, 'name') || stringField(item, 'Description'),
    address: stringField(item, 'address') || stringField(item, 'ShortAddress'),
  }
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** A slow carrier call is not stale. A crashed request is not left pending overnight. */
export const STALE_SHIPMENT_INTENT_MS = 10 * 60 * 1000

export function isStaleShipmentIntent(at: unknown, now = Date.now()): boolean {
  if (typeof at !== 'string' || !at) return true
  const parsed = Date.parse(at)
  if (!Number.isFinite(parsed)) return true
  return now - parsed >= STALE_SHIPMENT_INTENT_MS
}

export function novaPostClientOrder(orderId: string, warehouseId: string): string {
  return `${orderId}:${warehouseId}`
}

export function stockOperationAllowed(operation: string): operation is 'add' | 'subtract' {
  return operation === 'add' || operation === 'subtract'
}

export function confirmedWarehouseId(input: { confirm?: unknown; warehouseId?: unknown }): string | null {
  if (input.confirm !== true || typeof input.warehouseId !== 'string') return null
  const id = input.warehouseId.trim()
  return id || null
}

/** Remaining owed is the receipt amountOwed minus later supplier_payment rows only. */
export function supplierRemainingOwed(amountOwed: number, laterPayments: number): number {
  const owed = Number(amountOwed)
  const paid = Number(laterPayments)
  if (!Number.isFinite(owed) || owed <= 0) return 0
  const settled = Number.isFinite(paid) && paid > 0 ? paid : 0
  return Math.max(0, Math.round((owed - settled) * 100) / 100)
}

/** Compare money in cents so a float remainder does not refuse or allow a payment. */
export function paymentExceedsRemaining(payment: number, remaining: number): boolean {
  return Math.round(Number(payment) * 100) > Math.round(Number(remaining) * 100)
}

export function returnedAgainstSale(
  rows: Array<{ movementType?: string; quantityChange?: number; unsellableQuantity?: number }>,
): number {
  return rows.reduce((sum, row) => {
    if (row.movementType === 'return') return sum + Math.abs(Number(row.quantityChange || 0))
    if (row.movementType === 'damaged') return sum + Number(row.unsellableQuantity || 0)
    return sum
  }, 0)
}

export function remainingReturnable(soldQuantity: number, returned: number): number {
  return Math.max(0, Math.abs(Number(soldQuantity) || 0) - Math.max(0, Number(returned) || 0))
}

export type ShipmentLineRef = {
  fulfillmentWarehouseId?: string
  isPreorder?: boolean
  digitalProduct?: boolean
  instantDelivery?: boolean
}

export function warehouseIdsForShipment(lines: ShipmentLineRef[]): string[] {
  const ids: string[] = []
  for (const line of lines) {
    if (line.isPreorder || line.digitalProduct || line.instantDelivery) continue
    const id = line.fulfillmentWarehouseId || ZERO_WAREHOUSE_ID
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

export function parcelForGroup(
  lines: Array<{ weight?: string | null; dimensions?: string | null }>,
): { parcel: ResolvedParcel | null; suggestedWeight: number | null; needsConfirm: boolean } {
  if (lines.length === 1) {
    const resolved = resolveParcelFromLines(lines)
    if (resolved) return { parcel: resolved, suggestedWeight: resolved.weight, needsConfirm: false }
  }
  const weights = lines.map((line) => parseShippingWeight(line.weight))
  const suggestedWeight = weights.length > 0 && weights.every((value) => value != null)
    ? weights.reduce<number>((sum, value) => sum + (value || 0), 0)
    : null
  return { parcel: null, suggestedWeight, needsConfirm: true }
}

export function readCarrierShipment(body: unknown): { id?: string; number?: string; status?: string } {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const nestedRaw = root.data || root.item || (Array.isArray(root.items) ? root.items[0] : undefined)
  const nested = nestedRaw && typeof nestedRaw === 'object' ? (nestedRaw as Record<string, unknown>) : {}
  const source = Object.keys(nested).length ? nested : root
  return {
    id: source.id != null ? String(source.id) : undefined,
    number: typeof source.number === 'string' ? source.number : undefined,
    status: typeof source.status === 'string' ? source.status : undefined,
  }
}

const FIXTURE_REDACT_KEYS = new Set([
  'phone',
  'address',
  'name',
  'apikey',
  'api_key',
  'jwt',
  'firstname',
  'lastname',
  'email',
  'senderphone',
  'token',
  'authorization',
  'password',
  'secret',
])

const FIXTURE_KEEP_STRINGS = new Set([
  'id',
  'number',
  'status',
  'code',
  'date',
  'tracking_update_date',
  'payertype',
  'rownumber',
  'weight',
  'length',
  'width',
  'height',
  'type',
  'currency',
])

/** Keep parser fields. Strip phones, addresses, names, and keys from a create response. */
export function redactShipmentFixture(value: unknown, key?: string): unknown {
  if (key && FIXTURE_REDACT_KEYS.has(key.toLowerCase())) return '[redacted]'
  if (typeof value === 'string') {
    if (key && FIXTURE_KEEP_STRINGS.has(key.toLowerCase())) return value
    return redactCarrierError(value)
  }
  if (Array.isArray(value)) return value.map((item) => redactShipmentFixture(item))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = redactShipmentFixture(child, childKey)
    }
    return out
  }
  return value
}

export type StoredShipmentIntent = {
  status?: string
  at?: string
  reconciled?: boolean
  detail?: string
}

export type StoredShipmentParcel = {
  weight: number
  length: number
  width: number
  height: number
  source?: string
  confirmedAt?: string
  confirmedBy?: string
}

export type StoredWarehouseShipment = {
  warehouseId: string
  id?: string
  number?: string
  status?: string
  history?: Array<{ status?: string; date?: string }>
  createdAt?: string
  trackedAt?: string
  parcel?: StoredShipmentParcel
  intent?: StoredShipmentIntent
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function readParcel(value: unknown): StoredShipmentParcel | undefined {
  const stored = asRecord(value)
  const weight = Number(stored.weight)
  const length = Number(stored.length)
  const width = Number(stored.width)
  const height = Number(stored.height)
  if (![weight, length, width, height].every((item) => Number.isFinite(item) && item > 0)) return undefined
  return {
    weight,
    length,
    width,
    height,
    source: typeof stored.source === 'string' ? stored.source : undefined,
    confirmedAt: typeof stored.confirmedAt === 'string' ? stored.confirmedAt : undefined,
    confirmedBy: typeof stored.confirmedBy === 'string' ? stored.confirmedBy : undefined,
  }
}

function readIntent(value: unknown): StoredShipmentIntent | undefined {
  const intent = asRecord(value)
  if (!intent.status && !intent.at && !intent.detail) return undefined
  return {
    status: typeof intent.status === 'string' ? intent.status : undefined,
    at: typeof intent.at === 'string' ? intent.at : undefined,
    reconciled: intent.reconciled === true ? true : undefined,
    detail: typeof intent.detail === 'string' ? intent.detail : undefined,
  }
}

function readHistory(value: unknown): Array<{ status?: string; date?: string }> | undefined {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 12).map((entry) => {
    const item = asRecord(entry)
    return {
      status: typeof item.status === 'string' ? item.status : undefined,
      date: typeof item.date === 'string' ? item.date : undefined,
    }
  })
}

function readOneShipment(warehouseId: string, value: unknown): StoredWarehouseShipment {
  const row = asRecord(value)
  return {
    warehouseId,
    id: row.id != null && row.id !== '' ? String(row.id) : undefined,
    number: typeof row.number === 'string' && row.number ? row.number : undefined,
    status: typeof row.status === 'string' ? row.status : undefined,
    history: readHistory(row.history),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    trackedAt: typeof row.trackedAt === 'string' ? row.trackedAt : undefined,
    parcel: readParcel(row.parcel),
    intent: readIntent(row.intent),
  }
}

function firstPhysicalWarehouse(order: Record<string, unknown>): string {
  const items = Array.isArray(order.items) ? order.items : []
  for (const raw of items) {
    const item = asRecord(raw)
    const nested = asRecord(item.product)
    const digital = Boolean(item.digitalProduct || nested.digitalProduct || item.instantDelivery || nested.instantDelivery)
    if (item.isPreorder || digital) continue
    const warehouseId = item.fulfillmentWarehouseId
    return typeof warehouseId === 'string' && warehouseId ? warehouseId : ZERO_WAREHOUSE_ID
  }
  return ZERO_WAREHOUSE_ID
}

/**
 * New orders store one record per warehouse. An older order may still have a
 * single shipment, intent, and parcel. Those rows are not rewritten.
 */
export function readOrderShipments(order: Record<string, unknown>): StoredWarehouseShipment[] {
  const raw = order.shipments
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length > 0) {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([warehouseId]) => warehouseId)
      .map(([warehouseId, value]) => readOneShipment(warehouseId, value))
  }
  const legacy = asRecord(order.shipment)
  const intent = readIntent(order.shipmentIntent)
  const parcel = readParcel(order.shipmentParcel)
  const number = typeof legacy.number === 'string' && legacy.number ? legacy.number : undefined
  if (!number && !intent && !parcel) return []
  return [{
    warehouseId: firstPhysicalWarehouse(order),
    id: legacy.id != null && legacy.id !== '' ? String(legacy.id) : undefined,
    number,
    status: typeof legacy.status === 'string' ? legacy.status : undefined,
    history: readHistory(legacy.history),
    createdAt: typeof legacy.createdAt === 'string' ? legacy.createdAt : undefined,
    trackedAt: typeof legacy.trackedAt === 'string' ? legacy.trackedAt : undefined,
    parcel,
    intent,
  }]
}

export function shipmentDocumentMap(order: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const raw = order.shipments
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length > 0) {
    const out: Record<string, Record<string, unknown>> = {}
    for (const [warehouseId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!warehouseId) continue
      out[warehouseId] = { ...asRecord(value), warehouseId }
    }
    return out
  }
  const out: Record<string, Record<string, unknown>> = {}
  for (const record of readOrderShipments(order)) {
    out[record.warehouseId] = { ...record }
  }
  return out
}

export function evaluateShippableCap(input: {
  max: number | null
  digitalProduct?: boolean
  instantDelivery?: boolean
  allowPreorder?: boolean
  nextQty: number
}): { ok: true } | { ok: false; max: number } {
  if (input.digitalProduct || input.instantDelivery) return { ok: true }
  if (input.max == null) return { ok: true }
  if (input.max === 0 && input.allowPreorder) return { ok: true }
  if (input.nextQty > input.max) return { ok: false, max: input.max }
  return { ok: true }
}
