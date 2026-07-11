import 'server-only'

import { db } from '@/lib/database'
import { RewardCreditAddEventConfigSchema, type RewardCreditAddEventConfig, type RewardCreditAddEventStatus } from '@/lib/zod/credit-reward-schemas'

export async function findRewardCreditAddEventByIdempotencyKey(
  idempotencyKey: string,
): Promise<RewardCreditAddEventConfig | null> {
  const result = await db().queryDocs<RewardCreditAddEventConfig>({
    collection: 'credit_add_events',
    filters: [{ field: 'idempotency_key', operator: '==', value: idempotencyKey }],
    pagination: { limit: 1 },
  })

  if (!result.success || !result.data?.length) {
    return null
  }

  // Validate and parse using the schema
  try {
    return RewardCreditAddEventConfigSchema.parse(result.data[0])
  } catch {
    return null
  }
}

export async function createRewardCreditAddEvent(event: RewardCreditAddEventConfig): Promise<RewardCreditAddEventConfig> {
  const id = `credit_add_event_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  // Validate and strip unknown properties before storing
  const validatedEvent = RewardCreditAddEventConfigSchema.parse(event)
  const payload: RewardCreditAddEventConfig = {
    ...validatedEvent,
    id,
    created_at: now,
    updated_at: now,
  }

  // Exclude 'id' from doc payload to comply with db.createDoc contract
  // Table SSOT: credit_add_events (migration 022)
  const { id: _omit, ...docPayload } = payload
  const result = await db().createDoc('credit_add_events', docPayload, { id })
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to create reward credit add event')
  }

  return { ...payload }
}

export async function updateRewardCreditAddEventStatus(
  eventId: string,
  status: RewardCreditAddEventStatus,
  patch: Partial<RewardCreditAddEventConfig> = {},
): Promise<void> {
  // Optionally validate patch before updating
  let safePatch: Partial<RewardCreditAddEventConfig>
  try {
    // Only keep fields from the schema
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
