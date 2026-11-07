import { db } from '@/lib/database'
import {
  DEFAULT_INVENTORY_STORE_ID,
  DEFAULT_WAREHOUSE_NAME,
  ZERO_WAREHOUSE_ID,
} from '@/features/store/constants/stock'
import { STORE_COLLECTIONS } from '@/features/store/constants/collections'
import type { StockMovement } from '@/features/store/types/erp-stock'
import {
  formatFulfillmentShortfall,
  isKnownUnitCost,
  movementDocId,
  movementValue,
  movingAverage,
  pickFulfillmentWarehouse,
  paymentExceedsRemaining,
  supplierRemainingOwed,
  type WarehouseAvailability,
} from '@/features/store/services/fulfillment-ledger'

export { movingAverage } from '@/features/store/services/fulfillment-ledger'
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
  senderPhone?: string
  canShip?: boolean
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
    senderPhone: typeof row.senderPhone === 'string' ? row.senderPhone : undefined,
    canShip: row.canShip === true,
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

export async function getFulfillmentWarehouse(warehouseId: string): Promise<FulfillmentWarehouse | null> {
  const rows = await listFulfillmentWarehouses()
  const found = rows.find((row) => row.id === warehouseId)
  if (found) return found
  if (!warehouseId || warehouseId === ZERO_WAREHOUSE_ID) return syntheticDefault()
  return null
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

function toAvailability(
  warehouses: FulfillmentWarehouse[],
  levels: LevelRow[],
): WarehouseAvailability[] {
  return warehouses.map((warehouse) => {
    const level = levels.find((row) => row.storeId === warehouse.inventoryStoreId)
    return {
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      storeId: warehouse.inventoryStoreId,
      active: warehouse.active,
      isDefault: warehouse.isDefault,
      available: Number(level?.available ?? 0),
    }
  })
}

export async function chooseFulfillmentWarehouse(input: {
  productId: string
  quantity: number
  explicitWarehouseId?: string
}): Promise<{ warehouseId: string; storeId: string } | null> {
  const warehouses = await listFulfillmentWarehouses()
  const levels = await levelsForProduct(input.productId)
  return pickFulfillmentWarehouse({
    quantity: input.quantity,
    explicitWarehouseId: input.explicitWarehouseId,
    warehouses: toAvailability(warehouses, levels),
  })
}

export async function explainFulfillmentShortfall(input: {
  productId: string
  quantity: number
}): Promise<{ max: number; message: string; warehouses: WarehouseAvailability[] }> {
  const warehouses = await listFulfillmentWarehouses()
  const levels = await levelsForProduct(input.productId)
  const rows = toAvailability(warehouses, levels).filter((row) => row.active)
  const formatted = formatFulfillmentShortfall({
    requested: input.quantity,
    rows,
  })
  return { ...formatted, warehouses: rows }
}

export async function maxShippableQuantity(productId: string): Promise<{
  max: number
  warehouses: Array<{ id: string; name: string; code: string; available: number }>
}> {
  const explained = await explainFulfillmentShortfall({ productId, quantity: 1 })
  return {
    max: explained.max,
    warehouses: explained.warehouses.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      available: row.available,
    })),
  }
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
  userId?: string
  receiptMovementId?: string
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
  const warehouse =
    warehouses.find((row) => row.id === warehouseId) ||
    (await getFulfillmentWarehouse(warehouseId)) ||
    warehouses[0]
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
    if (row.movementType === 'supplier_payment') {
      supplierPaid += Number(row.amountPaid || 0)
      supplierOwed -= Number(row.amountPaid || 0)
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
    supplierOwed: Math.max(0, supplierOwed),
    referralOwed,
    vendorNetOwed,
    vendorNetPaid,
    products,
    catalog: [...names.entries()].map(([productId, name]) => ({ productId, name })).sort((a, b) => a.name.localeCompare(b.name)),
    movements: combined.slice(0, 40).map((row) => {
      const paidLater = own
        .filter((payment) => payment.movementType === 'supplier_payment' && payment.receiptMovementId === row.id)
        .reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0)
      return {
        id: row.id,
        productId: row.productId,
        productName: names.get(row.productId) || row.productId,
        movementType: row.movementType,
        quantityChange: Number(row.quantityChange || 0),
        counterWarehouseId: row.counterWarehouseId,
        amountPaid: row.amountPaid,
        amountOwed:
          row.movementType === 'receipt'
            ? Math.max(0, Number(row.amountOwed || 0) - paidLater)
            : row.amountOwed,
        timestamp: row.timestamp,
        userId: row.userId,
        receiptMovementId: row.receiptMovementId,
      }
    }),
  }
}

type LockedLevel = {
  available?: number
  reserved?: number
  syncVersion?: number
  unitCost?: number
}

async function movementExists(
  transaction: { read: (collection: string, id: string) => Promise<{ data?: unknown } | null> },
  id: string,
): Promise<boolean> {
  const existing = await transaction.read(STORE_COLLECTIONS.stockMovements, id)
  return Boolean(existing?.data)
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
  idempotencyKey?: string
}): Promise<void> {
  const quantity = Math.floor(input.quantity)
  if (quantity < 1) throw new Error('Quantity is required')
  if (Number(input.unitCost) < 0 || Number(input.amountPaid) < 0 || Number(input.amountOwed) < 0) {
    throw new Error('Cost and amounts cannot be negative')
  }
  const warehouse = await getFulfillmentWarehouse(input.warehouseId)
  if (!warehouse) throw new Error('Warehouse not found')
  const product = await db().findDocById<{ stock?: number; name?: string }>('store_products', input.productId)
  if (!product.success || !product.data) throw new Error('Product not found')
  const now = new Date().toISOString()
  const levelId = `${input.productId}_${warehouse.inventoryStoreId}`
  const movementId = movementDocId(input.idempotencyKey)

  await db().transaction(async (transaction) => {
    const productDoc = await transaction.read('store_products', input.productId)
    if (!productDoc?.data) throw new Error('Product not found')
    if (await movementExists(transaction, movementId)) return
    const levelDoc = await transaction.read('inventory_levels', levelId)
    const level = levelDoc?.data as LockedLevel | undefined
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

    const currentStock = Number((productDoc.data as { stock?: number }).stock || 0)
    const stock = currentStock + quantity
    await transaction.update('store_products', input.productId, {
      stock,
      inStock: stock > 0,
      updatedAt: now,
    })
    const movement: StockMovement = {
      id: movementId,
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
  idempotencyKey?: string
}): Promise<void> {
  const quantity = Math.floor(input.quantity)
  if (quantity < 1) throw new Error('Quantity is required')
  if (input.fromWarehouseId === input.toWarehouseId) throw new Error('Choose another warehouse')
  const source = await getFulfillmentWarehouse(input.fromWarehouseId)
  const target = await getFulfillmentWarehouse(input.toWarehouseId)
  if (!source || !target) throw new Error('Warehouse not found')
  const now = new Date().toISOString()
  const sourceLevelId = `${input.productId}_${source.inventoryStoreId}`
  const targetLevelId = `${input.productId}_${target.inventoryStoreId}`
  const movementId = movementDocId(input.idempotencyKey)

  await db().transaction(async (transaction) => {
    await transaction.read('store_products', input.productId)
    if (await movementExists(transaction, movementId)) return
    const sourceDoc = await transaction.read('inventory_levels', sourceLevelId)
    const sourceLevel = sourceDoc?.data as LockedLevel | undefined
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
    const targetLevel = targetDoc?.data as LockedLevel | undefined
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
      id: movementId,
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

export async function recordSupplierPayment(
  receiptMovementId: string,
  amount: number,
  userId?: string,
  idempotencyKey?: string,
): Promise<void> {
  const payment = Number(amount)
  if (!Number.isFinite(payment) || payment <= 0) throw new Error('Payment amount is required')
  const current = await db().findDocById<StockMovement>('stock_movements', receiptMovementId)
  if (!current.success || !current.data) throw new Error('Receipt not found')
  if (current.data.movementType !== 'receipt') throw new Error('Receipt not found')
  const now = new Date().toISOString()
  const movementId = movementDocId(idempotencyKey)
  await db().transaction(async (transaction) => {
    const receipt = await transaction.read(STORE_COLLECTIONS.stockMovements, receiptMovementId)
    const receiptRow = receipt?.data as StockMovement | undefined
    if (!receiptRow || receiptRow.movementType !== 'receipt') throw new Error('Receipt not found')
    if (await movementExists(transaction, movementId)) return
    const payments = await db().queryDocs<StockMovement & { id: string }>({
      collection: STORE_COLLECTIONS.stockMovements,
      filters: [
        { field: 'movementType', operator: '=', value: 'supplier_payment' },
        { field: 'receiptMovementId', operator: '=', value: receiptMovementId },
      ],
      pagination: { limit: 500 },
    })
    const paymentRows = payments.success && payments.data ? payments.data : []
    if (paymentRows.length >= 500) throw new Error('Payment history is incomplete')
    const paid = paymentRows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0)
    const remaining = supplierRemainingOwed(Number(receiptRow.amountOwed || 0), paid)
    if (paymentExceedsRemaining(payment, remaining)) {
      throw new Error(`Payment exceeds the remaining ${remaining.toFixed(2)}`)
    }
    const movement: StockMovement = {
      id: movementId,
      productId: receiptRow.productId,
      warehouseId: current.data!.warehouseId,
      movementType: 'supplier_payment',
      quantityBefore: Number(receiptRow.quantityAfter || 0),
      quantityChange: 0,
      quantityAfter: Number(receiptRow.quantityAfter || 0),
      userId,
      reason: `Supplier payment against ${receiptMovementId}`,
      timestamp: now,
      amountPaid: payment,
      receiptMovementId,
    }
    await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
  })
}

export async function adjustWarehouseStock(input: {
  warehouseId: string
  productId: string
  quantity: number
  direction: 'add' | 'subtract'
  reason: string
  userId?: string
  idempotencyKey?: string
}): Promise<void> {
  await postQuantityChange({ ...input, movementType: 'adjustment' })
}

export async function damageWarehouseStock(input: {
  warehouseId: string
  productId: string
  quantity: number
  reason: string
  userId?: string
  idempotencyKey?: string
}): Promise<void> {
  await postQuantityChange({ ...input, direction: 'subtract', movementType: 'damaged' })
}

async function postQuantityChange(input: {
  warehouseId: string
  productId: string
  quantity: number
  direction: 'add' | 'subtract'
  reason: string
  userId?: string
  idempotencyKey?: string
  movementType: 'adjustment' | 'damaged'
}): Promise<void> {
  const quantity = Math.floor(input.quantity)
  const reason = input.reason.trim()
  if (quantity < 1) throw new Error('Quantity is required')
  if (!reason) throw new Error('Reason is required')
  const warehouse = await getFulfillmentWarehouse(input.warehouseId)
  if (!warehouse) throw new Error('Warehouse not found')
  const now = new Date().toISOString()
  const levelId = `${input.productId}_${warehouse.inventoryStoreId}`
  const movementId = movementDocId(input.idempotencyKey)
  const delta = input.direction === 'add' ? quantity : -quantity

  await db().transaction(async (transaction) => {
    await transaction.read('store_products', input.productId)
    if (await movementExists(transaction, movementId)) return
    const levelDoc = await transaction.read('inventory_levels', levelId)
    const level = levelDoc?.data as LockedLevel | undefined
    const available = Number(level?.available || 0)
    const reserved = Number(level?.reserved || 0)
    if (!level || available + delta < 0) {
      throw new Error('Cannot reduce stock below the reserved quantity')
    }
    const average = Number(level.unitCost || 0)
    const nextAvailable = available + delta
    await transaction.update('inventory_levels', levelId, {
      available: nextAvailable,
      reserved,
      total: nextAvailable + reserved,
      unitCost: average,
      lastUpdated: now,
      syncVersion: (level.syncVersion || 0) + 1,
    })
    const productDoc = await transaction.read('store_products', input.productId)
    const currentStock = Number((productDoc?.data as { stock?: number } | undefined)?.stock || 0)
    const stock = Math.max(0, currentStock + delta)
    await transaction.update('store_products', input.productId, {
      stock,
      inStock: stock > 0,
      updatedAt: now,
    })
    const movement: StockMovement = {
      id: movementId,
      productId: input.productId,
      warehouseId: warehouse.id,
      movementType: input.movementType,
      quantityBefore: available + reserved,
      quantityChange: delta,
      quantityAfter: nextAvailable + reserved,
      userId: input.userId,
      reason,
      timestamp: now,
      unitCost: isKnownUnitCost(average) ? average : 0,
      value: movementValue(quantity, average),
    }
    await transaction.create(STORE_COLLECTIONS.stockMovements, movement, { id: movement.id })
  })
}
