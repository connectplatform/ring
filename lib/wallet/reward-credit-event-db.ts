import 'server-only'

import { db } from '@/lib/database'
import {
  RewardCreditAddEventConfigSchema,
  type RewardCreditAddEventConfig,
  type RewardCreditAddEventStatus,
} from '@/lib/zod/credit-reward-schemas'

function normalizeEventRow(row: Record<string, unknown>): Record<string, unknown> {
  // queryDocs may return flat JSONB fields or nested data
  const data =
    row.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : row
  return {
    ...data,
    id: String(row.id ?? data.id ?? ''),
  }
}

export async function findRewardCreditAddEventByIdempotencyKey(
  idempotencyKey: string,
): Promise<RewardCreditAddEventConfig | null> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'credit_add_events',
    filters: [{ field: 'idempotency_key', operator: '==', value: idempotencyKey }],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  try {
    return RewardCreditAddEventConfigSchema.parse(normalizeEventRow(result.data[0]))
  } catch {
    return null
  }
}

export async function createRewardCreditAddEvent(
  event: RewardCreditAddEventConfig,
): Promise<RewardCreditAddEventConfig> {
  const id = event.id?.startsWith('credit_add_event_')
    ? event.id
    : `credit_add_event_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const validatedEvent = RewardCreditAddEventConfigSchema.parse({
    ...event,
    id,
    created_at: event.created_at || now,
    updated_at: now,
  })
  const payload: RewardCreditAddEventConfig = validatedEvent

  const { id: _omit, ...docPayload } = payload
  const result = await db().createDoc('credit_add_events', docPayload, { id })
  if (!result.success) {
    const msg = result.error?.message || 'Failed to create reward credit add event'
    // Unique idempotency race → surface so caller can treat as existing
    if (/unique|duplicate|idempotency/i.test(msg)) {
      const err = new Error(msg)
      ;(err as Error & { code?: string }).code = 'IDEMPOTENCY_CONFLICT'
      throw err
    }
    throw new Error(msg)
  }

  return { ...payload, id }
}

export async function updateRewardCreditAddEventStatus(
  eventId: string,
  status: RewardCreditAddEventStatus,
  patch: Partial<RewardCreditAddEventConfig> = {},
): Promise<void> {
  let safePatch: Partial<RewardCreditAddEventConfig>
  try {
    safePatch = RewardCreditAddEventConfigSchema.partial().parse(patch)
  } catch {
    throw new Error('Invalid patch data for reward credit add event')
  }

  const result = await db().updateDoc('credit_add_events', eventId, {
    status,
    ...safePatch,
    updated_at: new Date().toISOString(),
  })

  if (!result.success) {
    throw new Error(result.error?.message ?? 'Failed to update reward credit add event')
  }
}

/** Completed reward points for a user on a UTC calendar day. */
export async function sumCompletedRewardPointsForUtcDay(
  userId: string,
  utcDay: string,
): Promise<number> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'credit_add_events',
    filters: [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'status', operator: '==', value: 'completed' },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit: 500 },
  })
  if (!result.success || !result.data?.length) return 0

  let sum = 0
  for (const raw of result.data) {
    const row = normalizeEventRow(raw)
    const created = String(row.created_at ?? row.completed_at ?? '')
    if (!created.startsWith(utcDay)) continue
    const meta = (row.metadata as Record<string, unknown>) || {}
    const amt = Number(meta.final_amount ?? row.amount ?? 0)
    if (Number.isFinite(amt)) sum += amt
  }
  return sum
}

export async function listCompletedRewardEventsForUser(
  userId: string,
  limit = 500,
): Promise<RewardCreditAddEventConfig[]> {
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: 'credit_add_events',
    filters: [
      { field: 'user_id', operator: '==', value: userId },
      { field: 'status', operator: '==', value: 'completed' },
    ],
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    pagination: { limit },
  })
  if (!result.success || !result.data?.length) return []

  const out: RewardCreditAddEventConfig[] = []
  for (const raw of result.data) {
    try {
      out.push(RewardCreditAddEventConfigSchema.parse(normalizeEventRow(raw)))
    } catch {
      // skip malformed rows
    }
  }
  return out
}
