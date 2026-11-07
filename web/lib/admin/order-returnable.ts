import { returnableForLines } from '@/features/store/services/inventory-sync'

export async function withReturnableQuantities<T extends {
  id: string
  items?: Array<{ productId?: string; fulfillmentWarehouseId?: string; returnable?: number }>
  shipments?: Array<{ number?: string }>
}>(orders: T[]): Promise<T[]> {
  return Promise.all(orders.map(async (order) => {
    if (!order.shipments?.some((row) => row.number) || !order.items?.length) return order
    const remaining = await returnableForLines(
      order.id,
      order.items.map((item) => ({
        productId: item.productId,
        fulfillmentWarehouseId: item.fulfillmentWarehouseId,
      })),
    )
    return {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        returnable: remaining.get(`${item.productId || ''}:${item.fulfillmentWarehouseId || ''}`),
      })),
    }
  }))
}
