import 'server-only'

/**
 * Airdrop Service — User-Credit-Balance Airdrops ONLY
 * 
 * This module implements the business logic for awarding USD credit points to users
 * for completing specific actions on the platform. All configuration for
 * triggers and their properties is managed through ring-config.json and is validated via Zod schema
 * in @/lib/zod/credit-reward-schemas.ts.
 * 
 * Rewards may be triggered by actions such as:
 * - adminKYCVerified: User is verified by admin KYC
 * - userSetUniqueUsername: User sets a unique username
 * - profileCompleted: User completes profile
 * - eventParticipation: User joins a platform event
 * 
 * NOTE: On-chain/native token airdrops are out of scope for this phase; see section at bottom.
 */

import { RewardCreditAddEventRuleSchema } from '@/lib/zod/credit-reward-schemas'

// Import necessary database operations for the reward credit add event
import {
  findRewardCreditAddEventByIdempotencyKey,
  createRewardCreditAddEvent,
  updateRewardCreditAddEventStatus,
} from '@/lib/wallet/reward-credit-event-db'

// Import the credit balance service (handles actual user credit balance updates)
import { creditBalanceService } from '@/features/wallet/services/credit-balance-service'
// Import config snapshot function for reading up-to-date config values
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'

// Import all relevant types and Zod schemas for reward event config
import type {
  RewardCreditAddEventTrigger, 
  RewardCreditAddEventRule,
} from '@/lib/zod/credit-reward-schemas'
import { z } from 'zod'

/**
 * Locate and validate the rule config for a given trigger (action key).
 * Returns parsed rule config or undefined if not found or invalid.
 * 
 * @param trigger - The action enum key (RewardCreditAddEventTrigger)
 * @returns - Parsed config object, or undefined if not present/valid
 */

export function ruleForTrigger(
  trigger: RewardCreditAddEventTrigger
): RewardCreditAddEventRule | undefined {
  // Obtain latest system config snapshot
  const config = getSystemConfigSnapshot()
  const eventRules = config.credits?.rewards?.events ?? {}

  // Direct key lookup: `eventRules` is a map { [triggerKey]: RuleConfig }
  if (trigger in eventRules) {
    // Validate and parse via schema, guarantee shape
    try {
      // We want a single rule schema, not map
      return RewardCreditAddEventRuleSchema.parse(eventRules[trigger])
    } catch (error) {
      console.error(`Error parsing reward event rule for trigger ${trigger}:`, error instanceof Error ? error.message : String(error))
      return undefined
    }
  } else {
    console.error(`No reward event rule found for trigger ${trigger}`)
    return undefined
  }
}

/**
 * Attempts to enqueue and execute a reward airdrop for a user-action event.
 * Ensures the rules from credit-reward-schemas are followed.
 * 
 * 1. Look up rule config for trigger.
 * 2. Enforce gating fields (enabled, requireUsername, requireVerified).
 * 3. Check for idempotency (prior completed event for this user+trigger).
 * 4. Create new pending event if none exists; apply credit amount.
 * 5. On success/failure, update status and return.
 * 
 * @param params - { userId, trigger, username, isVerified }
 * @returns     - Status, job id and awarded amount.
 */
export async function enqueueRewardCreditAddEvent(params: {
  userId: string
  trigger: RewardCreditAddEventTrigger
  username?: string | null
  isVerified?: boolean
}): Promise<{
  status: 'skipped' | 'completed' | 'existing'
  jobId?: string
  amount?: string
}> {
  // Load the rule definition for the trigger (validate struct)
  const ruleConfig = ruleForTrigger(params.trigger) as z.infer<typeof RewardCreditAddEventRuleSchema>
  if (!ruleConfig) {
    return { status: 'skipped' }
  }

  // Gating: requireUsername/requireVerified (with null coalescence fallback)
  if (
    (ruleConfig.requireUsername && !params.username) ||
    (ruleConfig.requireVerified && !params.isVerified)
  ) {
    return { status: 'skipped' }
  }

  // Compute idempotency key: unique for trigger+user
  const idempotencyKey = `credit_add_event:${params.trigger}:${params.userId}`

  // Check if previously completed event for this (idempotent)
  const existing = await findRewardCreditAddEventByIdempotencyKey(idempotencyKey)
  if (existing && existing.status === 'completed') {
    return { status: 'existing', jobId: existing.id, amount: existing.amount }
  }

  // Generate job id`
  const id = crypto.randomUUID()
  // Always use reward amount as string
  const amount = String(ruleConfig.amount)

  // Create new DB event as "pending"
  const job = await createRewardCreditAddEvent({
    id,
    idempotency_key: idempotencyKey,
    user_id: params.userId,
    trigger: params.trigger as RewardCreditAddEventTrigger, // new: use "trigger", not "rule"
    rule: ruleConfig as z.infer<typeof RewardCreditAddEventRuleSchema>,
    amount,
    description: ruleConfig.amount ?? `Reward credit add event: ${params.trigger}`,
    metadata: {
      trigger: params.trigger,
      rewardCreditAddEventId: id,
    },
    status: 'pending',  
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })

  try {
    // Actually credit the user
    const result = await creditBalanceService.addCredits(
      params.userId,
      {
        amount,
        description:
          ruleConfig.amount ??
          `Reward credit add event: ${params.trigger}`,
        metadata: {
          trigger: params.trigger,
          rewardCreditAddEventId: id,
        },
      },
      'reward_credit_add',
      '1', // USD (fiat) credits always 1:1 here
    )

    // Mark as completed, attach transaction info
    await updateRewardCreditAddEventStatus(job.id!, 'completed', {
      transaction_id: result.transaction.id,
      description: `Reward credit add event completed: ${params.trigger}`,
      completed_at: new Date().toISOString(),
    })

    return { status: 'completed', jobId: id, amount }
  } catch (error) {
    // On failure
    const message = error instanceof Error ? error.message : 'Reward credit add event failed'
    await updateRewardCreditAddEventStatus(job.id!, 'failed', {
      failure_reason: message,
    })
    return { status: 'skipped', jobId: id, amount }
  }
}

/**
 * Returns an aggregate summary of airdrop rewards received by the user.
 * 
 * Structure:
 * {
 *    totalReceived: string,       // Total sum of reward-credits granted to user (all triggers)
 *    byTrigger: {
 *      [triggerKey]: {
 *        count: number,           // Number of airdrops for that trigger
 *        total: string            // Total amount for that trigger
 *      }
 *    }
 * }
 * 
 * @param userId
 * @returns reward summary object
 */
export async function getUserRewardCreditAddEventSummary(userId: string): Promise<{
  totalReceived: string
  byTrigger: Record<string, { count: number; total: string }>
}> {
  // MOCK CODE, TODO: Query reward_credit_add_events DB/collection for user's reward history
  // TODO: Implement the following steps:
  //   1. Fetch all events for userId with status 'completed'
  //   2. Aggregate reward amount per trigger type (rule)
  //   3. Return total and grouped summary
  //   4. Use native Next.js 16 server-side cache to memoize queries for hot users (if needed)
  return {
    totalReceived: '0',
    byTrigger: {},
  }
}

// ============================================================================
// TBD: On-Chain Native Token Airdrops (Phase 2)
// ============================================================================
//
// The following on-chain airdrop functionality was REMOVED from this service
// in favor of user-credit-balance airdrops only.
//
// Original implementation (TBD Phase 2):
// - Used executeAirdropTransfer() for Solana native token transfers
// - Had separate airdrop_jobs collection with chain_signature field
// - Required native wallet, compliance screening, etc.
//
// To re-enable on-chain airdrops in Phase 2:
// 1. Add 'native_token_airdrops' section to ring-config.json
// 2. Create new service: lib/wallet/native-token-airdrop-service.ts
// 3. Update ring-config-types.ts to include native token airdrop rules
// 4. Re-implement with gasless treasury-sponsored transfers
// 5. Add separate collection: native_token_airdrop_jobs
//
// SSOT: user-credit-balance airdrops are the ONLY supported airdrop type
// for Phase 1. Native token airdrops are deferred to Phase 2.
// ============================================================================
