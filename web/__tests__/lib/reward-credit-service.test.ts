import {
  RewardCreditAddEventRuleSchema,
  RewardCreditAddEventTriggerSchema,
} from '@/lib/zod/credit-reward-schemas'
import { computeRewardFinalAmount } from '@/lib/wallet/reward-credit-math'

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
