import {
  RewardCreditAddEventRuleSchema,
  RewardCreditAddEventTriggerSchema,
  CreditRewardsConfigSchema,
} from '@/lib/zod/credit-reward-schemas'
import { computeRewardFinalAmount } from '@/lib/wallet/reward-credit-math'
import { resolveCreditRewardsEnabled } from '@/lib/wallet/credit-rewards-gate'

describe('RewardCreditAddEventRuleSchema', () => {
  it('defaults idempotencyMode to once_per_user', () => {
    const rule = RewardCreditAddEventRuleSchema.parse({ amount: '10' })
    expect(rule.idempotencyMode).toBe('once_per_user')
    expect(rule.enabled).toBe(true)
  })

  it('accepts once_per_object', () => {
    const rule = RewardCreditAddEventRuleSchema.parse({
      amount: '2',
      idempotencyMode: 'once_per_object',
      requireUsername: false,
    })
    expect(rule.idempotencyMode).toBe('once_per_object')
  })

  it('includes curated content triggers', () => {
    expect(RewardCreditAddEventTriggerSchema).toContain('newsStoryApproved')
    expect(RewardCreditAddEventTriggerSchema).toContain('commentCreated')
    expect(RewardCreditAddEventTriggerSchema).toContain('reviewCreated')
    expect(RewardCreditAddEventTriggerSchema).toContain('requestCreated')
  })
})

describe('computeRewardFinalAmount', () => {
  it('applies member 1.5x with floor', () => {
    expect(computeRewardFinalAmount(10, 1.5)).toBe(15)
    expect(computeRewardFinalAmount(2, 1.5)).toBe(3)
  })

  it('applies confidential 2x', () => {
    expect(computeRewardFinalAmount(50, 2)).toBe(100)
  })

  it('never zeros a positive base', () => {
    expect(computeRewardFinalAmount(1, 0.4)).toBe(1)
  })
})

describe('resolveCreditRewardsEnabled', () => {
  it('defaults to enabled when omitted', () => {
    expect(resolveCreditRewardsEnabled(undefined, undefined)).toBe(true)
    expect(resolveCreditRewardsEnabled({}, {})).toBe(true)
  })

  it('honors credit.rewards.enabled false', () => {
    expect(resolveCreditRewardsEnabled({ enabled: false }, { enabled: true })).toBe(false)
  })

  it('falls back to credits.rewards.enabled', () => {
    expect(resolveCreditRewardsEnabled(undefined, { enabled: false })).toBe(false)
    expect(resolveCreditRewardsEnabled(undefined, { enabled: true })).toBe(true)
  })

  it('coerces string and numeric JSON footguns', () => {
    expect(resolveCreditRewardsEnabled({ enabled: 'false' })).toBe(false)
    expect(resolveCreditRewardsEnabled({ enabled: 'true' })).toBe(true)
    expect(resolveCreditRewardsEnabled({ enabled: 0 })).toBe(false)
    expect(resolveCreditRewardsEnabled({ enabled: 1 })).toBe(true)
  })
})

describe('CreditRewardsConfigSchema', () => {
  it('defaults global enabled to true', () => {
    const parsed = CreditRewardsConfigSchema.parse({ minRole: 'subscriber' })
    expect(parsed.enabled).toBe(true)
  })

  it('accepts enabled false', () => {
    const parsed = CreditRewardsConfigSchema.parse({ enabled: false })
    expect(parsed.enabled).toBe(false)
  })
})
