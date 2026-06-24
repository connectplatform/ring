import { getRingConfigSnapshot } from '@/lib/ring-config-core'
import type { RingMembershipTierConfig } from '@/lib/ring-config-types'
import { UserRole } from '@/features/auth/user-role'

const DEFAULT_RING_MEMBER_AMOUNT = 1

/** RING token cost for subscriber → member upgrade (ring-config SSOT). */
export function getMembershipRingUpgradeAmount(): number {
  const ring = getRingConfigSnapshot().membership?.ring
  return ring?.memberUpgradeAmount ?? DEFAULT_RING_MEMBER_AMOUNT
}

/** RING token cost for monthly subscription renewal. */
export function getMembershipRingRenewalAmount(): number {
  const ring = getRingConfigSnapshot().membership?.ring
  return ring?.subscriptionRenewalAmount ?? ring?.memberUpgradeAmount ?? DEFAULT_RING_MEMBER_AMOUNT
}

/** WayForPay fiat tier for a purchasable role. */
export function getMembershipFiatTier(role: UserRole.member | UserRole.subscriber): RingMembershipTierConfig | null {
  const tiers = getRingConfigSnapshot().membership?.tiers
  if (!tiers) return null
  return tiers[role] ?? null
}

export function getMemberFiatTier(): RingMembershipTierConfig {
  return (
    getMembershipFiatTier(UserRole.member) ?? {
      amount: 299,
      currency: 'UAH',
      description: 'Ring Platform Member Upgrade',
      duration: '1 month',
    }
  )
}

/** Display fiat price (e.g. ₴299 for UAH). */
export function formatMembershipFiatAmount(tier: RingMembershipTierConfig): string {
  if (tier.currency === 'UAH') {
    return `₴${tier.amount}`
  }
  return `${tier.amount} ${tier.currency}`
}
