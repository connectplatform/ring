/**
 * Admin list DTO helpers — keep RSC→client props plain JSON (no Date / fat blobs).
 */

export const ADMIN_LIST_PAGE_SIZE = 50

export function toIsoString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
  }
  return undefined
}

export function toIsoStringRequired(value: unknown, fallback = new Date(0).toISOString()): string {
  return toIsoString(value) ?? fallback
}

export interface AdminOrderItemDto {
  name?: string
  quantity?: number
  price?: string
  currency?: string
}

export interface AdminOrderDto {
  id: string
  status?: string
  userId?: string
  createdAt?: string
  items?: AdminOrderItemDto[]
}

export function toAdminOrderDto(row: Record<string, unknown> & { id: string }): AdminOrderDto {
  const rawItems = Array.isArray(row.items) ? row.items : []
  const items: AdminOrderItemDto[] = rawItems.map((item) => {
    const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      name: entry.name != null ? String(entry.name) : undefined,
      quantity: typeof entry.quantity === 'number' ? entry.quantity : Number(entry.quantity) || undefined,
      price: entry.price != null ? String(entry.price) : undefined,
      currency: entry.currency != null ? String(entry.currency) : undefined,
    }
  })

  const rawStatus = row.status != null ? String(row.status) : undefined
  // SalesBox imports used British "cancelled"; Ring UI/status SSOT is "canceled"
  const status = rawStatus === 'cancelled' ? 'canceled' : rawStatus

  return {
    id: String(row.id),
    status,
    userId: row.userId != null ? String(row.userId) : undefined,
    createdAt: toIsoString(row.createdAt ?? row.created_at),
    items,
  }
}
