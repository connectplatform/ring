import { NextRequest, NextResponse, connection } from 'next/server'
import { db } from '@/lib/database'
import { shouldSkipPhysicalStock } from '@/features/store/constants/stock'
import { maxShippableQuantity } from '@/features/store/services/warehouse-fulfillment'

export async function GET(request: NextRequest) {
  await connection()
  const ids = (request.nextUrl.searchParams.get('ids') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 40)
  const items = []
  for (const productId of ids) {
    const product = await db().findDocById<Record<string, unknown>>('store_products', productId)
    const row = product.success ? product.data : null
    if (
      row &&
      shouldSkipPhysicalStock({
        product: {
          digitalProduct: Boolean(row.digitalProduct),
          instantDelivery: Boolean(row.instantDelivery),
        },
      })
    ) {
      items.push({ productId, max: null, warehouses: [] })
      continue
    }
    const shippable = await maxShippableQuantity(productId)
    items.push({
      productId,
      max: shippable.max,
      warehouses: shippable.warehouses,
    })
  }
  return NextResponse.json({ items })
}
