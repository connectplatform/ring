import {
  evaluateShippableCap,
  formatFulfillmentShortfall,
} from '@/features/store/services/fulfillment-ledger'

type CachedShippable = {
  max: number | null
  warehouses: Array<{ name: string; code: string; available: number }>
}

const cache = new Map<string, CachedShippable>()
const inflight = new Map<string, Promise<CachedShippable>>()

async function loadShippable(productId: string): Promise<CachedShippable> {
  const hit = cache.get(productId)
  if (hit) return hit
  const pending = inflight.get(productId)
  if (pending) return pending
  const request = fetch(`/api/store/fulfillment/shippable?ids=${encodeURIComponent(productId)}`, {
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error('shippable unavailable')
      const json = (await response.json()) as {
        items?: Array<{ productId?: string; max?: number | null; warehouses?: CachedShippable['warehouses'] }>
      }
      const item = Array.isArray(json.items)
        ? json.items.find((row) => row.productId === productId) || json.items[0]
        : undefined
      const max = item && (item.max === null || typeof item.max === 'number') ? item.max : 0
      const warehouses = Array.isArray(item?.warehouses) ? item.warehouses : []
      const stored = { max, warehouses }
      cache.set(productId, stored)
      return stored
    })
    .finally(() => {
      inflight.delete(productId)
    })
  inflight.set(productId, request)
  return request
}

export type ShippableGuard = {
  ok: boolean
  max: number | null
  message?: string
}

export async function guardShippableAdd(input: {
  productId: string
  digitalProduct?: boolean
  instantDelivery?: boolean
  allowPreorder?: boolean
  nextQty: number
}): Promise<ShippableGuard> {
  if (input.digitalProduct || input.instantDelivery) return { ok: true, max: null }
  try {
    const shippable = await loadShippable(input.productId)
    const decision = evaluateShippableCap({
      max: shippable.max,
      digitalProduct: input.digitalProduct,
      instantDelivery: input.instantDelivery,
      allowPreorder: input.allowPreorder,
      nextQty: input.nextQty,
    })
    if (decision.ok === false) {
      return {
        ok: false,
        max: decision.max,
        message: formatFulfillmentShortfall({
          requested: input.nextQty,
          rows: shippable.warehouses,
        }).message,
      }
    }
    return { ok: true, max: null }
  } catch {
    return { ok: false, max: null }
  }
}
