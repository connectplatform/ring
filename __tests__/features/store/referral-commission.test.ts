/** @jest-environment node */

import {
  clampReferralPercent,
  computeWeightedReferralCommissionFromOrderItems,
  resolveReferralCommissionPercent,
} from '@/features/store/lib/referral-commission'
import { DEFAULT_COMMISSION_STRUCTURE } from '@/constants/store'

const merchantWithSeven = {
  commissionStructure: { referralCommission: 7, platformCommission: 15 },
}

describe('resolveReferralCommissionPercent', () => {
  const originalEnv = process.env.REFERRAL_COMMISSION_MAX_PERCENT

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REFERRAL_COMMISSION_MAX_PERCENT
    } else {
      process.env.REFERRAL_COMMISSION_MAX_PERCENT = originalEnv
    }
  })

  it('prefers product-level referralCommission override', () => {
    const result = resolveReferralCommissionPercent({ referralCommission: 10 }, merchantWithSeven)
    expect(result.percent).toBe(10)
    expect(result.source).toBe('product')
  })

  it('falls back to product.commissionStructure then merchant then default', () => {
    expect(
      resolveReferralCommissionPercent(
        { commissionStructure: { referralCommission: 8, platformCommission: 15 } },
        merchantWithSeven,
      ).percent,
    ).toBe(8)

    expect(resolveReferralCommissionPercent(undefined, merchantWithSeven).percent).toBe(7)

    expect(resolveReferralCommissionPercent(undefined, undefined).percent).toBe(
      DEFAULT_COMMISSION_STRUCTURE.referralCommission,
    )
  })

  it('clamps values to REFERRAL_COMMISSION_MAX_PERCENT', () => {
    process.env.REFERRAL_COMMISSION_MAX_PERCENT = '30'
    expect(clampReferralPercent(99)).toBe(30)
    expect(clampReferralPercent(-5)).toBe(0)
    expect(resolveReferralCommissionPercent({ referralCommission: 45 }).percent).toBe(30)
  })
})

describe('computeWeightedReferralCommissionFromOrderItems', () => {
  it('returns zero when no referral code', () => {
    const result = computeWeightedReferralCommissionFromOrderItems(
      [{ productId: 'p1', name: 'A', price: '100', currency: 'UAH', quantity: 1 }],
      false,
    )
    expect(result.amount).toBe(0)
    expect(result.itemRates).toHaveLength(0)
  })

  it('weights mixed product rates by line subtotal', () => {
    const products = new Map([
      ['p1', { referralCommission: 10 }],
      ['p2', {}],
    ])

    const result = computeWeightedReferralCommissionFromOrderItems(
      [
        { productId: 'p1', name: 'A', price: '100', currency: 'UAH', quantity: 1 },
        { productId: 'p2', name: 'B', price: '100', currency: 'UAH', quantity: 1 },
      ],
      true,
      undefined,
      products,
    )

    expect(result.amount).toBe(15)
    expect(result.effectivePercent).toBeCloseTo(7.5, 5)
    expect(result.itemRates).toHaveLength(2)
  })
})
