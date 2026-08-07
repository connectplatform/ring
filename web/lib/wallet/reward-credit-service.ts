import 'server-only'

/**
 * Reward Credit Service — user credit-balance awards for platform actions.
 *
 * SSOT config: ring-config.json → credit.rewards
 * Ledger: creditBalanceService.addCredits(..., 'reward_credit_add')
 * Audit: credit_add_events
 *
 * Future: native token airdrops are out of scope (separate service if needed).
 */

import {
  RewardCreditAddEventRuleSchema,
  type RewardCreditAddEventTrigger,
  type RewardCreditAddEventRule,
} from '@/lib/zod/credit-reward-schemas'
import {
  findRewardCreditAddEventByIdempotencyKey,
  createRewardCreditAddEvent,
  updateRewardCreditAddEventStatus,
  sumCompletedRewardPointsForUtcDay,
  listCompletedRewardEventsForUser,
} from '@/lib/wallet/reward-credit-event-db'
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
import {
  getRewardCreditRules,
  getRewardMinRole,
  getRewardMultiplierForRole,
  getRewardDailyEarnCap,
} from '@/lib/ring-config-chain'
import { getMainCurrencyCreditAccountingRate } from '@/lib/ring-oracle'
import { computeRewardFinalAmount } from '@/lib/wallet/reward-credit-math'
import {
  ROLE_LEVEL,
  parseUserRolesArray,
  resolvePersistedUserRole,
  type UserRolesArray,
} from '@/features/auth/user-role'
import { db } from '@/lib/database'

export { computeRewardFinalAmount } from '@/lib/wallet/reward-credit-math'

export function ruleForTrigger(
  trigger: RewardCreditAddEventTrigger,
): RewardCreditAddEventRule | undefined {
  const eventRules = getRewardCreditRules()
  if (!(trigger in eventRules)) {
    return undefined
  }
  try {
    return RewardCreditAddEventRuleSchema.parse(eventRules[trigger])
  } catch (error) {
    console.error(
      `Error parsing reward event rule for trigger ${trigger}:`,
      error instanceof Error ? error.message : String(error),
    )
    return undefined
  }
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function buildIdempotencyKey(params: {
  trigger: string
  userId: string
  mode: string
  objectType?: string
  objectId?: string
}): string | null {
  let key: string
  if (params.mode === 'once_per_object') {
    if (!params.objectType || !params.objectId) return null
    key = `credit_add_event:${params.trigger}:${params.userId}:${params.objectType}:${params.objectId}`
  } else {
    key = `credit_add_event:${params.trigger}:${params.userId}`
  }
  if (key.length > 200) return null
  return key
}

function meetsMinRole(userRole: UserRolesArray, minRoleRaw: string): boolean {
  const minRole = parseUserRolesArray(minRoleRaw) ?? resolvePersistedUserRole(minRoleRaw)
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole]
}

async function resolveUserContext(userId: string): Promise<{
  role: UserRolesArray
  username: string | null
  isVerified: boolean
}> {
  const result = await db().findDocById<Record<string, unknown>>('users', userId)
  const data = result.success ? result.data : null
  const role = resolvePersistedUserRole(data?.role)
  const username =
    (typeof data?.username === 'string' && data.username.trim()) ||
    null
  const isVerified = Boolean(data?.isVerified ?? data?.is_verified)
  return { role, username, isVerified }
}

export type EnqueueRewardResult = {
  status: 'skipped' | 'completed' | 'existing' | 'failed'
  jobId?: string
  amount?: string
  reason?: string
}

/**
 * Award credit points for a user action (idempotent, role-gated, capped).
 */
export async function enqueueRewardCreditAddEvent(params: {
  userId: string
  trigger: RewardCreditAddEventTrigger
  username?: string | null
  isVerified?: boolean
  userRole?: string | null
  objectType?: string
  objectId?: string
}): Promise<EnqueueRewardResult> {
  const ruleConfig = ruleForTrigger(params.trigger)
  if (!ruleConfig) {
    return { status: 'skipped', reason: 'no_rule' }
  }
  if (ruleConfig.enabled === false) {
    return { status: 'skipped', reason: 'disabled' }
  }

  const ctx = await resolveUserContext(params.userId)
  const userRole =
    parseUserRolesArray(params.userRole) ??
    ctx.role
  const username = params.username !== undefined ? params.username : ctx.username
  const isVerified =
    params.isVerified !== undefined ? params.isVerified : ctx.isVerified

  const minRole = getRewardMinRole()
  if (!meetsMinRole(userRole, minRole)) {
    return { status: 'skipped', reason: 'min_role' }
  }

  if (ruleConfig.requireUsername && !username) {
    return { status: 'skipped', reason: 'require_username' }
  }
  if (ruleConfig.requireVerified && !isVerified) {
    return { status: 'skipped', reason: 'require_verified' }
  }

  const mode = ruleConfig.idempotencyMode ?? 'once_per_user'
  if (mode === 'once_per_object' && (!params.objectType || !params.objectId)) {
    return { status: 'skipped', reason: 'missing_object' }
  }

  const idempotencyKey = buildIdempotencyKey({
    trigger: params.trigger,
    userId: params.userId,
    mode,
    objectType: params.objectType,
    objectId: params.objectId,
  })
  if (!idempotencyKey) {
    return { status: 'skipped', reason: 'idempotency_key_invalid' }
  }

  const existing = await findRewardCreditAddEventByIdempotencyKey(idempotencyKey)
  if (existing && existing.status === 'completed') {
    return { status: 'existing', jobId: existing.id, amount: existing.amount }
  }

  const base = Number(ruleConfig.amount)
  if (!Number.isFinite(base) || base <= 0) {
    return { status: 'skipped', reason: 'invalid_amount' }
  }
  const multiplier = getRewardMultiplierForRole(userRole)
  const final = computeRewardFinalAmount(base, multiplier)

  const day = utcDayKey()
  const earnedToday = await sumCompletedRewardPointsForUtcDay(params.userId, day)
  const dailyCap = getRewardDailyEarnCap(userRole)
  const remaining = dailyCap - earnedToday
  if (!(remaining >= final)) {
    // Do NOT write idempotency_key row — that would permanently block the award.
    return {
      status: 'skipped',
      amount: String(final),
      reason: 'daily_cap',
    }
  }

  const id = crypto.randomUUID()
  const amount = String(final)
  const metadata = {
    trigger: params.trigger,
    rewardCreditAddEventId: id,
    base_amount: base,
    multiplier,
    final_amount: final,
    user_role: userRole,
    object_type: params.objectType,
    object_id: params.objectId,
  }

  let jobId = id
  try {
    const job = await createRewardCreditAddEvent({
      id,
      idempotency_key: idempotencyKey,
      user_id: params.userId,
      trigger: params.trigger,
      rule: ruleConfig,
      amount,
      description: `Reward ${params.trigger}: ${amount}`,
      metadata,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    jobId = job.id || id
  } catch (error) {
    const code = (error as Error & { code?: string }).code
    if (code === 'IDEMPOTENCY_CONFLICT') {
      const again = await findRewardCreditAddEventByIdempotencyKey(idempotencyKey)
      return {
        status: 'existing',
        jobId: again?.id,
        amount: again?.amount,
        reason: 'idempotency_conflict',
      }
    }
    throw error
  }

  try {
    const mainCurrencyRate = getMainCurrencyCreditAccountingRate()
    const result = await creditBalanceService.addCredits(
      params.userId,
      {
        amount,
        description: `Reward ${params.trigger}: ${amount}`,
        metadata,
      },
      'reward_credit_add',
      mainCurrencyRate,
    )

    await updateRewardCreditAddEventStatus(jobId, 'completed', {
      transaction_id: result.transaction.id,
      description: `Reward credit add event completed: ${params.trigger}`,
      completed_at: new Date().toISOString(),
      metadata,
      amount,
    })

    try {
      const { appendEvent } = await import('@/lib/events/event-log.server')
      await appendEvent({
        type: 'reward_credit_add',
        userId: params.userId,
        reversible: false,
        payload: {
          trigger: params.trigger,
          amount,
          base_amount: base,
          multiplier,
          final_amount: final,
          user_role: userRole,
          rewardCreditAddEventId: jobId,
          transactionId: result.transaction.id,
          object_type: params.objectType,
          object_id: params.objectId,
        },
      })
    } catch {
      // non-blocking audit
    }

    try {
      const { notifyRewardCreditReceived } = await import(
        '@/features/notifications/services/notification-triggers'
      )
      const { getCreditUnitLabel } = await import('@/lib/ring-oracle')
      await notifyRewardCreditReceived(
        params.userId,
        amount,
        params.trigger,
        getCreditUnitLabel(),
      )
    } catch {
      // non-blocking notify — balance already credited + published via credit:balance
    }

    return { status: 'completed', jobId, amount }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reward credit add event failed'
    await updateRewardCreditAddEventStatus(jobId, 'failed', {
      failure_reason: message,
      metadata: { ...metadata, skip_reason: undefined },
    })
    return { status: 'failed', jobId, amount, reason: message }
  }
}

export async function getUserRewardCreditAddEventSummary(userId: string): Promise<{
  totalReceived: string
  byTrigger: Record<string, { count: number; total: string }>
}> {
  const events = await listCompletedRewardEventsForUser(userId)
  let total = 0
  const byTrigger: Record<string, { count: number; total: number }> = {}

  for (const ev of events) {
    const meta = (ev.metadata || {}) as Record<string, unknown>
    const amt = Number(meta.final_amount ?? ev.amount ?? 0)
    if (!Number.isFinite(amt)) continue
    total += amt
    const key = String(ev.trigger)
    if (!byTrigger[key]) byTrigger[key] = { count: 0, total: 0 }
    byTrigger[key].count += 1
    byTrigger[key].total += amt
  }

  return {
    totalReceived: String(total),
    byTrigger: Object.fromEntries(
      Object.entries(byTrigger).map(([k, v]) => [
        k,
        { count: v.count, total: String(v.total) },
      ]),
    ),
  }
}
