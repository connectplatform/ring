import { db } from '@/lib/database'
import {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import type { StockMovement } from '@/features/store/types/erp-stock'
interface LevelRow {
  id?: string
  productId: string
  storeId: string
  available?: number
  reserved?: number
  unitCost?: number
}

export interface FulfillmentWarehouse {
  id: string
  name: string
  code: string
  address: string
  active: boolean
  isDefault: boolean
  inventoryStoreId: string
  novaPostSenderDivisionId?: string
  novaPostSenderDivisionName?: string
  novaPostSenderAddress?: string
}

const syntheticDefault = (): FulfillmentWarehouse => ({
  id: ZERO_WAREHOUSE_ID,
  name: DEFAULT_WAREHOUSE_NAME,
  code: 'main',
  address: '',
  active: true,
  isDefault: true,
  inventoryStoreId: DEFAULT_INVENTORY_STORE_ID,
})

function asWarehouse(row: { id: string } & Record<string, unknown>): FulfillmentWarehouse {
  const id = String(row.id)
  const isDefault = Boolean(row.isDefault) || id === ZERO_WAREHOUSE_ID
  const stored = typeof row.inventoryStoreId === 'string' ? row.inventoryStoreId : ''
  return {
    id,
    name: typeof row.name === 'string' && row.name ? row.name : isDefault ? DEFAULT_WAREHOUSE_NAME : id,
    code: typeof row.code === 'string' && row.code ? row.code : isDefault ? 'main' : id,
    address: typeof row.address === 'string' ? row.address : '',
    active: row.active !== false,
    isDefault,
    inventoryStoreId: isDefault ? stored || DEFAULT_INVENTORY_STORE_ID : stored || id,
    novaPostSenderDivisionId:
      typeof row.novaPostSenderDivisionId === 'string' ? row.novaPostSenderDivisionId : undefined,
    novaPostSenderDivisionName:
      typeof row.novaPostSenderDivisionName === 'string' ? row.novaPostSenderDivisionName : undefined,
    novaPostSenderAddress:
      typeof row.novaPostSenderAddress === 'string' ? row.novaPostSenderAddress : undefined,
  }
}

export async function listFulfillmentWarehouses(): Promise<FulfillmentWarehouse[]> {
  try {
    const result = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'warehouses',
      pagination: { limit: 500 },
    })
    if (!result.success || !result.data) return [syntheticDefault()]
    const rows = result.data.map((row) => asWarehouse(row))
    for (const row of rows) {
      if (!row.isDefault && row.inventoryStoreId === row.id) {
        const raw = result.data.find((item) => item.id === row.id)
        const stored = raw && typeof raw.inventoryStoreId === 'string' ? raw.inventoryStoreId : ''
        if (!stored) {
          await db().updateDoc('warehouses', row.id, { inventoryStoreId: row.id })
        }
      }
    }
    if (!rows.some((row) => row.id === ZERO_WAREHOUSE_ID)) {
      rows.unshift(syntheticDefault())
    }
    return rows.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return a.code.localeCompare(b.code)
    })
  } catch {
    return [syntheticDefault()]
  }
}

export async function getFulfillmentWarehouse(warehouseId: string): Promise<FulfillmentWarehouse> {
  const rows = await listFulfillmentWarehouses()
  return rows.find((row) => row.id === warehouseId) || syntheticDefault()
}

export async function levelsForProduct(productId: string): Promise<LevelRow[]> {
  const result = await db().queryDocs<LevelRow & { id: string }>({
    collection: 'inventory_levels',
    filters: [{ field: 'productId', operator: '=', value: productId }],
    pagination: { limit: 100 },
  })
  if (!result.success || !result.data) return []
  return result.data
}

export async function chooseFulfillmentWarehouse(input: {
  productId: string
  quantity: number
  explicitWarehouseId?: string
}): Promise<{ warehouseId: string; storeId: string } | null> {
  const warehouses = (await listFulfillmentWarehouses()).filter((row) => row.active)
  const levels = await levelsForProduct(input.productId)
  const availableAt = (warehouse: FulfillmentWarehouse) => {
    const level = levels.find((row) => row.storeId === warehouse.inventoryStoreId)
    return Number(level?.available ?? 0)
  }
  const explicit = input.explicitWarehouseId
    ? warehouses.find((row) => row.id === input.explicitWarehouseId)
    : undefined
  if (explicit) {
    return availableAt(explicit) >= input.quantity
      ? { warehouseId: explicit.id, storeId: explicit.inventoryStoreId }
      : null
  }
  const preferred = warehouses.find((row) => row.id === ZERO_WAREHOUSE_ID) || warehouses.find((row) => row.isDefault)
  if (preferred && availableAt(preferred) >= input.quantity) {
    return { warehouseId: preferred.id, storeId: preferred.inventoryStoreId }
  }
  const rest = warehouses
    .filter((row) => row.id !== preferred?.id)
    .sort((a, b) => a.code.localeCompare(b.code))
  const match = rest.find((row) => availableAt(row) >= input.quantity)
  if (!match) return null
  return { warehouseId: match.id, storeId: match.inventoryStoreId }
}

export function movingAverage(onHand: number, oldCost: number, qty: number, unitCost: number): number {
  const next = onHand + qty
  if (next <= 0) return unitCost
  return (onHand * oldCost + qty * unitCost) / next
}

export async function sumLevelsForProduct(productId: string): Promise<number> {
  const levels = await levelsForProduct(productId)
  return levels.reduce((sum, level) => sum + Number(level.available || 0) + Number(level.reserved || 0), 0)
}

export interface WarehouseProductStock {
  productId: string
  name: string
  available: number
  reserved: number
  unitCost: number
  stockValue: number
}

export interface WarehouseMovementRow {
  id: string
  productId: string
  productName: string
  movementType: string
  quantityChange: number
  counterWarehouseId?: string
  amountPaid?: number
  amountOwed?: number
  timestamp: string
}

export interface WarehouseStockReport {
  warehouse: FulfillmentWarehouse
  warehouses: FulfillmentWarehouse[]
  remaining: number
  reserved: number
  receivedQty: number
  supplierPaid: number
  supplierOwed: number
  referralOwed: number
  vendorNetOwed: number
  vendorNetPaid: number
  products: WarehouseProductStock[]
  catalog: Array<{ productId: string; name: string }>
  movements: WarehouseMovementRow[]
}

export async function getWarehouseStockReport(warehouseId: string): Promise<WarehouseStockReport> {
  const warehouses = await listFulfillmentWarehouses()
  const warehouse = warehouses.find((row) => row.id === warehouseId) || (await getFulfillmentWarehouse(warehouseId))
  const levelsResult = await db().queryDocs<LevelRow & { id: string }>({
    collection: 'inventory_levels',
    filters: [{ field: 'storeId', operator: '=', value: warehouse.inventoryStoreId }],
    pagination: { limit: 500 },
  })
  const levels = levelsResult.success && levelsResult.data ? levelsResult.data : []
  const productsResult = await db().queryDocs<{ id: string; name?: string }>({
    collection: 'store_products',
    pagination: { limit: 500 },
  })
  const names = new Map(
    (productsResult.success && productsResult.data ? productsResult.data : []).map((row) => [
      row.id,
      String(row.name || row.id),
    ]),
  )
  const products: WarehouseProductStock[] = levels
    .map((level) => {
      const available = Number(level.available || 0)
      const reserved = Number(level.reserved || 0)
      const unitCost = Number(level.unitCost || 0)
      return {
        productId: level.productId,
        name: names.get(level.productId) || level.productId,
        available,
        reserved,
        unitCost,
        stockValue: (available + reserved) * unitCost,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const movementResult = await db().queryDocs<StockMovement & { id: string }>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [{ field: 'warehouseId', operator: '=', value: warehouse.id }],
    pagination: { limit: 200 },
  })
  const inbound = await db().queryDocs<StockMovement & { id: string }>({
    collection: STORE_COLLECTIONS.stockMovements,
    filters: [{ field: 'counterWarehouseId', operator: '=', value: warehouse.id }],
    pagination: { limit: 100 },
  })
  const own = movementResult.success && movementResult.data ? movementResult.data : []
  const transfersIn = (inbound.success && inbound.data ? inbound.data : []).filter(
    (row) => row.movementType === 'transfer',
  )
  const combined = [...own, ...transfersIn].sort((a, b) =>
    String(b.timestamp || '').localeCompare(String(a.timestamp || '')),
  )
  let receivedQty = 0
  let supplierPaid = 0
  let supplierOwed = 0
  const saleOrderIds = new Set<string>()
  const saleProductsByOrder = new Map<string, Set<string>>()
  for (const row of own) {
    if (row.movementType === 'receipt') {
      receivedQty += Number(row.quantityChange || 0)
      supplierPaid += Number(row.amountPaid || 0)
      supplierOwed += Number(row.amountOwed || 0)
    }
    if (row.movementType === 'transfer' && row.counterWarehouseId === warehouse.id) {
      receivedQty += Math.abs(Number(row.quantityChange || 0))
    }
    if (row.movementType === 'sale' && row.orderId) {
      saleOrderIds.add(row.orderId)
      const set = saleProductsByOrder.get(row.orderId) || new Set<string>()
      set.add(row.productId)
      saleProductsByOrder.set(row.orderId, set)
    }
  }

  let referralOwed = 0
  let vendorNetOwed = 0
  let vendorNetPaid = 0
  if (saleOrderIds.size > 0) {
    const settlements = await db().queryDocs<Record<string, unknown> & { id: string }>({
      collection: 'settlements',
      pagination: { limit: 400 },
    })
    const rows = settlements.success && settlements.data ? settlements.data : []
    for (const settlement of rows) {
      const orderId = String(settlement.orderId || '')
      if (!saleOrderIds.has(orderId)) continue
      const soldHere = saleProductsByOrder.get(orderId) || new Set<string>()
      const metadata = (settlement.metadata || {}) as {
        commissionBreakdown?: { referralByItem?: Array<{ productId?: string; amount?: number; subtotal?: number }> }
      }
      const items = metadata.commissionBreakdown?.referralByItem || []
      const matched = items.filter((item) => item.productId && soldHere.has(item.productId))
      const referral = matched.reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const matchedSubtotal = matched.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
      const amount = Number(settlement.amount || 0)
      const net = Number(settlement.netPayout || 0)
      const share = amount > 0 && matchedSubtotal > 0 ? Math.min(1, matchedSubtotal / amount) : matched.length ? 1 : 0
      const status = String(settlement.status || '')
      if (status === 'pending' || status === 'held') {
        referralOwed += referral
        vendorNetOwed += net * share
      } else if (status === 'completed') {
        vendorNetPaid += net * share
      }
    }
  }

  return {
    warehouse,
    warehouses: warehouses.filter((row) => row.active),
    remaining: products.reduce((sum, row) => sum + row.available, 0),
    reserved: products.reduce((sum, row) => sum + row.reserved, 0),
    receivedQty,
    supplierPaid,
    supplierOwed,
    referralOwed,
    vendorNetOwed,
    vendorNetPaid,
    products,
    catalog: [...names.entries()].map(([productId, name]) => ({ productId, name })).sort((a, b) => a.name.localeCompare(b.name)),
    movements: combined.slice(0, 40).map((row) => ({
      id: row.id,
      productId: row.productId,
      productName: names.get(row.productId) || row.productId,
      movementType: row.movementType,
      quantityChange: Number(row.quantityChange || 0),
      counterWarehouseId: row.counterWarehouseId,
      amountPaid: row.amountPaid,
      amountOwed: row.amountOwed,
      timestamp: row.timestamp,
    })),
  }
}

function movementId(): string {
  return `mov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export async function receiveIntoWarehouse(input: {
  warehouseId: string
  productId: string
  quantity: number
  unitCost: number
  amountPaid: number
  amountOwed: number
  supplierName?: string
  userId?: string
}): Promise<void> {
  const quantity = Math.floor(input.quantity)
  if (quantity < 1) throw new Error('Quantity is required')
  const warehouse = await getFulfillmentWarehouse(input.warehouseId)
  const product = await db().findDocById<{ stock?: number; name?: string }>('store_products', input.productId)
  if (!product.success || !product.data) throw new Error('Product not found')
  const now = new Date().toISOString()
  const levelId = `${input.productId}_${warehouse.inventoryStoreId}`

  await db().transaction(async (transaction) => {
    const levelDoc = await transaction.read('inventory_levels', levelId)
    const level = levelDoc?.data as {
      available?: number
      reserved?: number
      syncVersion?: number
      unitCost?: number
    } | undefined
    const available = Number(level?.available || 0)
    const reserved = Number(level?.reserved || 0)
    const onHand = available + reserved
    const unitCost = movingAverage(onHand, Number(level?.unitCost || 0), quantity, input.unitCost)
    const nextAvailable = available + quantity
    const payload = {
      productId: input.productId,
      storeId: warehouse.inventoryStoreId,
      available: nextAvailable,
      reserved,
      total: nextAvailable + reserved,
      unitCost,
      lastUpdated: now,
      syncVersion: (level?.syncVersion || 0) + 1,
    }
    if (level) await transaction.update('inventory_levels', levelId, payload)
    else await transaction.create('inventory_levels', payload, { id: levelId })

    const stock = Number(product.data?.stock || 0) + quantity
    await transaction.update('store_products', input.productId, {
      stock,
      inStock: stock > 0,
      updatedAt: now,
    })
    const movement: StockMovement = {
      id: movementId(),
      productId: input.productId,
      warehouseId: warehouse.id,
      movementType: 'receipt',
      quantityBefore: onHand,
      quantityChange: quantity,
      quantityAfter: onHand + quantity,
      userId: input.userId,
      reason: input.supplierName ? `Receipt from ${input.supplierName}` : 'Warehouse receipt',
      timestamp: now,
      unitCost: input.unitCost,
      amountPaid: input.amountPaid,
      amountOwed: input.amountOwed,
      supplierName: input.supplierName,
    }
    await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
  })
}

export async function transferBetweenWarehouses(input: {
  fromWarehouseId: string
  toWarehouseId: string
  productId: string
  quantity: number
  userId?: string
}): Promise<void> {
  const quantity = Math.floor(input.quantity)
  if (quantity < 1) throw new Error('Quantity is required')
  if (input.fromWarehouseId === input.toWarehouseId) throw new Error('Choose another warehouse')
  const source = await getFulfillmentWarehouse(input.fromWarehouseId)
  const target = await getFulfillmentWarehouse(input.toWarehouseId)
  const now = new Date().toISOString()
  const sourceLevelId = `${input.productId}_${source.inventoryStoreId}`
  const targetLevelId = `${input.productId}_${target.inventoryStoreId}`

  await db().transaction(async (transaction) => {
    const sourceDoc = await transaction.read('inventory_levels', sourceLevelId)
    const sourceLevel = sourceDoc?.data as {
      available?: number
      reserved?: number
      syncVersion?: number
      unitCost?: number
    } | undefined
    const available = Number(sourceLevel?.available || 0)
    if (!sourceLevel || available < quantity) throw new Error('Not enough remaining stock')
    const reserved = Number(sourceLevel.reserved || 0)
    const unitCost = Number(sourceLevel.unitCost || 0)
    const sourceNext = available - quantity
    await transaction.update('inventory_levels', sourceLevelId, {
      available: sourceNext,
      total: sourceNext + reserved,
      lastUpdated: now,
      syncVersion: (sourceLevel.syncVersion || 0) + 1,
    })

    const targetDoc = await transaction.read('inventory_levels', targetLevelId)
    const targetLevel = targetDoc?.data as {
      available?: number
      reserved?: number
      syncVersion?: number
      unitCost?: number
    } | undefined
    const targetAvailable = Number(targetLevel?.available || 0)
    const targetReserved = Number(targetLevel?.reserved || 0)
    const targetOnHand = targetAvailable + targetReserved
    const nextCost = movingAverage(targetOnHand, Number(targetLevel?.unitCost || 0), quantity, unitCost)
    const targetPayload = {
      productId: input.productId,
      storeId: target.inventoryStoreId,
      available: targetAvailable + quantity,
      reserved: targetReserved,
      total: targetOnHand + quantity,
      unitCost: nextCost,
      lastUpdated: now,
      syncVersion: (targetLevel?.syncVersion || 0) + 1,
    }
    if (targetLevel) await transaction.update('inventory_levels', targetLevelId, targetPayload)
    else await transaction.create('inventory_levels', targetPayload, { id: targetLevelId })

    const movement: StockMovement = {
      id: movementId(),
      productId: input.productId,
      warehouseId: source.id,
      counterWarehouseId: target.id,
      movementType: 'transfer',
      quantityBefore: available + reserved,
      quantityChange: -quantity,
      quantityAfter: sourceNext + reserved,
      userId: input.userId,
      reason: `Transfer to ${target.name}`,
      timestamp: now,
      unitCost,
    }
    await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
  })
}

export async function recordSupplierPayment(movementId: string, amount: number): Promise<void> {
  const payment = Number(amount)
  if (!Number.isFinite(payment) || payment <= 0) throw new Error('Payment amount is required')
  const current = await db().findDocById<StockMovement>('stock_movements', movementId)
  if (!current.success || !current.data) throw new Error('Receipt not found')
  if (current.data.movementType !== 'receipt') throw new Error('Receipt not found')
  const owed = Math.max(0, Number(current.data.amountOwed || 0) - payment)
  const paid = Number(current.data.amountPaid || 0) + payment
  const updated = await db().updateDoc('stock_movements', movementId, {
    amountOwed: owed,
    amountPaid: paid,
  })
  if (!updated.success) throw updated.error || new Error('Failed to record payment')
}
