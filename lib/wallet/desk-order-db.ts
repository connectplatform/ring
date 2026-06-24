import 'server-only'

import { db } from '@/lib/database'
import type { DeskOrder, DeskOrderStatus } from '@/lib/zod/desk-schemas'

type DeskOrderDoc = DeskOrder & Record<string, unknown> & { id: string }

export async function findDeskOrderByIdempotencyKey(
  idempotencyKey: string,
): Promise<DeskOrderDoc | null> {
  const result = await db().queryDocs<DeskOrderDoc>({
    collection: 'desk_orders',
    filters: [{ field: 'idempotency_key', operator: '==', value: idempotencyKey }],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  return result.data[0]
}

export async function createDeskOrder(order: DeskOrder): Promise<DeskOrderDoc> {
  const id = `desk_${crypto.randomUUID()}`
  const payload = {
    ...order,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const result = await db().createDoc('desk_orders', payload, { id })
  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to create desk order')
  }

  return { id, ...payload }
}

export async function updateDeskOrderStatus(
  orderId: string,
  status: DeskOrderStatus,
  patch: Partial<DeskOrder> = {},
): Promise<void> {
  const result = await db().updateDoc('desk_orders', orderId, {
    status,
    ...patch,
    updated_at: new Date().toISOString(),
  })

  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to update desk order')
  }
}
