import { ZERO_WAREHOUSE_ID } from '@/features/store/constants/stock'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  confirmedWarehouseId,
  evaluateShippableCap,
  formatFulfillmentShortfall,
  isStaleShipmentIntent,
  movementDocId,
  movingAverage,
  novaPostClientOrder,
  operatorMay,
  parcelForGroup,
  parseShippingDimensions,
  parseShippingWeight,
  pickFulfillmentWarehouse,
  readCarrierShipment,
  readDivisionSettlement,
  readOrderShipments,
  redactCarrierError,
  redactShipmentFixture,
  refuseSetBelowReserved,
  remainingReturnable,
  resolveParcelFromLines,
  STALE_SHIPMENT_INTENT_MS,
  stockOperationAllowed,
  paymentExceedsRemaining,
  supplierRemainingOwed,
  warehouseIdsForShipment,
  type WarehouseAvailability,
} from '@/features/store/services/fulfillment-ledger'

const warehouses: WarehouseAvailability[] = [
  {
    id: ZERO_WAREHOUSE_ID,
    name: 'Main',
    code: 'main',
    storeId: '1',
    active: true,
    isDefault: true,
    available: 2,
  },
  {
    id: 'west',
    name: 'West',
    code: 'west',
    storeId: 'west',
    active: true,
    available: 5,
  },
  {
    id: 'east',
    name: 'East',
    code: 'east',
    storeId: 'east',
    active: true,
    available: 1,
  },
]

describe('fulfillment ledger', () => {
  it('picks zero-warehouse before a larger warehouse sorted by code', () => {
    expect(pickFulfillmentWarehouse({ quantity: 2, warehouses })).toEqual({
      warehouseId: ZERO_WAREHOUSE_ID,
      storeId: '1',
    })
    expect(pickFulfillmentWarehouse({ quantity: 3, warehouses })).toEqual({
      warehouseId: 'west',
      storeId: 'west',
    })
    expect(pickFulfillmentWarehouse({ quantity: 6, warehouses })).toBeNull()
  })

  it('names the shortfall from the largest single warehouse', () => {
    const result = formatFulfillmentShortfall({ requested: 6, rows: warehouses })
    expect(result.max).toBe(5)
    expect(result.message).toContain('One warehouse must cover 6')
    expect(result.message).toContain('West (west): 5')
    expect(result.message).toContain('Transfer stock')
  })

  it('keeps unknown cost out of the moving average', () => {
    expect(movingAverage(100, 0, 100, 10)).toBe(10)
    expect(movingAverage(100, 10, 100, 0)).toBe(10)
    expect(movingAverage(100, 10, 100, 20)).toBe(15)
  })

  it('reuses an idempotency key as the movement id', () => {
    expect(movementDocId('click-1')).toBe('mov_click-1')
    expect(movementDocId('mov_click-1')).toBe('mov_click-1')
    expect(movementDocId('mov_click-1')).toBe(movementDocId('mov_click-1'))
  })

  it('refuses a set below reserved', () => {
    expect(refuseSetBelowReserved(2, 3)).toBe(true)
    expect(refuseSetBelowReserved(3, 3)).toBe(false)
  })

  it('parses parcel weight and dimensions', () => {
    expect(parseShippingWeight('1,2 kg')).toBe(1.2)
    expect(parseShippingDimensions('20×20×10')).toEqual({ length: 20, width: 20, height: 10 })
    expect(resolveParcelFromLines([{ weight: '1', dimensions: '20x20x10' }])?.source).toBe('product')
    expect(resolveParcelFromLines([
      { weight: '1', dimensions: '20x20x10' },
      { weight: '1', dimensions: '20x20x10' },
    ])).toBeNull()
  })

  it('lets a worker receive but not adjust, and blocks another warehouse', () => {
    expect(operatorMay({
      isPlatformAdmin: false,
      assignmentRole: 'worker',
      assignedWarehouseId: 'a',
      warehouseId: 'a',
      action: 'receive',
    })).toBe(true)
    expect(operatorMay({
      isPlatformAdmin: false,
      assignmentRole: 'worker',
      assignedWarehouseId: 'a',
      warehouseId: 'a',
      action: 'adjust',
    })).toBe(false)
    expect(operatorMay({
      isPlatformAdmin: false,
      assignmentRole: 'manager',
      assignedWarehouseId: 'a',
      warehouseId: 'b',
      action: 'receive',
    })).toBe(false)
  })

  it('groups physical lines and does not invent a multi-line parcel', () => {
    expect(warehouseIdsForShipment([
      { fulfillmentWarehouseId: 'west' },
      { fulfillmentWarehouseId: 'west', digitalProduct: true },
      { isPreorder: true },
      {},
    ])).toEqual(['west', ZERO_WAREHOUSE_ID])
    expect(parcelForGroup([
      { weight: '1', dimensions: '20x20x10' },
      { weight: '2', dimensions: '20x20x10' },
    ])).toEqual({ parcel: null, suggestedWeight: 3, needsConfirm: true })
    expect(novaPostClientOrder('order-1', 'west')).toBe('order-1:west')
  })

  it('caps a supplier payment at the report remaining and a return at the sale', () => {
    expect(supplierRemainingOwed(1000, 400)).toBe(600)
    expect(supplierRemainingOwed(600, 0)).toBe(600)
    expect(paymentExceedsRemaining(600.004, 600)).toBe(false)
    expect(paymentExceedsRemaining(600.01, 600)).toBe(true)
    expect(remainingReturnable(5, 2)).toBe(3)
    expect(remainingReturnable(5, 5)).toBe(0)
  })

  it('reads a legacy shipment and a per-warehouse map', () => {
    expect(readOrderShipments({
      items: [{ productId: 'p', fulfillmentWarehouseId: 'west', quantity: 1 }],
      shipment: { number: '2045' },
      shipmentIntent: { status: 'accepted', at: '2026-11-01T00:00:00.000Z' },
    })[0]).toMatchObject({ warehouseId: 'west', number: '2045' })
    expect(readOrderShipments({
      shipments: {
        west: { number: '1', intent: { status: 'pending', at: '2026-11-01T00:00:00.000Z' } },
      },
    }).map((row) => row.warehouseId)).toEqual(['west'])
  })

  it('flags a pending intent after 10 minutes and redacts a fixture', () => {
    const now = Date.parse('2026-11-06T12:00:00.000Z')
    expect(isStaleShipmentIntent(new Date(now - STALE_SHIPMENT_INTENT_MS - 1000).toISOString(), now)).toBe(true)
    expect(isStaleShipmentIntent(new Date(now - 60_000).toISOString(), now)).toBe(false)
    const redacted = redactShipmentFixture({
      number: '59000000000001',
      phone: '+380501112233',
      recipient: { name: 'Buyer', address: 'Street 1', phone: '+380501112233' },
      message: 'fail user@example.com',
    }) as { number: string; phone: string; recipient: { name: string; phone: string }; message: string }
    expect(redacted.number).toBe('59000000000001')
    expect(redacted.phone).toBe('[redacted]')
    expect(redacted.recipient.name).toBe('[redacted]')
    expect(redacted.recipient.phone).toBe('[redacted]')
    expect(redacted.message).not.toContain('user@example.com')
    expect(readCarrierShipment({ items: [{ number: '59000000000001', status: 'ready' }] }).number).toBe('59000000000001')
  })

  it('uses one warehouse max and closes set without a confirmed warehouse', () => {
    expect(evaluateShippableCap({ max: 2, nextQty: 3 })).toEqual({ ok: false, max: 2 })
    expect(evaluateShippableCap({ max: 0, nextQty: 1 })).toEqual({ ok: false, max: 0 })
    expect(evaluateShippableCap({ max: null, nextQty: 9 })).toEqual({ ok: true })
    expect(evaluateShippableCap({ max: 0, nextQty: 1, digitalProduct: true })).toEqual({ ok: true })
    expect(evaluateShippableCap({ max: 0, nextQty: 1, allowPreorder: true })).toEqual({ ok: true })
    expect(stockOperationAllowed('set')).toBe(false)
    expect(stockOperationAllowed('add')).toBe(true)
    expect(confirmedWarehouseId({ confirm: true, warehouseId: ' west ' })).toBe('west')
    expect(confirmedWarehouseId({ confirm: false, warehouseId: 'west' })).toBeNull()
  })

  it('reads a captured Nova Post body when the operator has saved one', () => {
    const fixture = path.join(process.cwd(), '__tests__/fixtures/shipping/novapost-create.redacted.json')
    if (!existsSync(fixture)) return
    const body = JSON.parse(readFileSync(fixture, 'utf8')) as unknown
    const shipment = readCarrierShipment(body)
    expect(shipment.number || shipment.id).toBeTruthy()
  })

  it('redacts phone and email and does not invent a settlement', () => {
    expect(redactCarrierError('fail +380501112233 user@example.com')).not.toContain('501112233')
    expect(redactCarrierError('fail +380501112233 user@example.com')).not.toContain('user@example.com')
    expect(readDivisionSettlement({ id: 'div-1', name: 'Branch' })?.settlementId).toBe('')
    expect(readDivisionSettlement({ id: 'div-1', settlement: { id: 'city-1' } })?.settlementId).toBe('city-1')
  })
})
