import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { MemberTierConfig } from '@/lib/ring-config-types'
import { UserRolesArray } from '@/features/auth/user-role'

const DEFAULT_RING_MEMBER_AMOUNT = 1

/** RING token cost for subscriber → member upgrade (ring-config SSOT). */
export function getMembershipRingUpgradeAmount(): number {
  const ring = getSystemConfigSnapshot().membership?.nativeToken
  return ring?.memberUpgradeAmount ?? DEFAULT_RING_MEMBER_AMOUNT
}

/** RING token cost for monthly subscription renewal. */
export function getMembershipRingRenewalAmount(): number {
  const ring = getSystemConfigSnapshot().membership?.nativeToken
  return ring?.subscriptionRenewalAmount ?? ring?.memberUpgradeAmount ?? DEFAULT_RING_MEMBER_AMOUNT
}

/** WayForPay fiat tier for a purchasable role. */
  export function getMembershipFiatTier(role: UserRolesArray.member | UserRolesArray.subscriber): MemberTierConfig | null {
  const tiers = getSystemConfigSnapshot().membership?.tiers
  if (!tiers) return null
  return tiers[role] ?? null
}

export function getMemberFiatTier(): MemberTierConfig {
  return (
    getMembershipFiatTier(UserRolesArray.member) ?? {
      amount: 299,
      currency: 'UAH',
      description: 'Ring Platform Member Upgrade',
      duration: '1 month',
    }
  )
}

/** Display fiat price (e.g. ₴299 for UAH). */
export function formatMembershipFiatAmount(tier: MemberTierConfig): string {
  if (tier.currency === 'UAH') {
    return `₴${tier.amount}`
  }
  return `${tier.amount} ${tier.currency}`
}
