import 'server-only'

/**
 * Live desk membership pricing — server only.
 *
 * The sync helpers in `pricing.ts` read the ring-config snapshot and are safe
 * everywhere (client components, RSC, static display). Charging must instead
 * quote the *live* desk oracle, so the amount the buyer is billed equals what
 * the desk quotes at that moment. Paying itself always goes through the
 * PaymentConductor.
 *
 * Kept in a separate module because the oracle reaches the database, which
 * must never be traced into a client bundle.
 */

import { getNativeTokenToMainCurrencyRate } from '@/lib/ring-oracle'
import { getSystemConfigSnapshot } from '@/lib/ring-config-core'
import type { MemberTierConfig } from '@/lib/ring-config-types'
import {
  getMemberMainCurrencyTierForPeriod,
  getMembershipMainCurrencyPerNativeToken,
  getMembershipRingAmountForPeriod,
  type MembershipBillingPeriod,
} from '@/lib/membership/pricing'

/** Live desk main-currency amount for a native token amount. */
export async function getLiveMembershipMainCurrencyAmountForNative(
  nativeAmount: number,
): Promise<number> {
  const { nativePerMainCurrency } = await getNativeTokenToMainCurrencyRate()
  const rate =
    Number.isFinite(nativePerMainCurrency) && nativePerMainCurrency > 0
      ? nativePerMainCurrency
      : getMembershipMainCurrencyPerNativeToken()
  return Math.round(nativeAmount * rate * 100) / 100
}

export async function getLiveMembershipMainCurrencyAmountForPeriod(
  period: MembershipBillingPeriod,
): Promise<number> {
  return getLiveMembershipMainCurrencyAmountForNative(getMembershipRingAmountForPeriod(period))
}

/**
 * When `pricedInNativeToken` is false, `membership.tiers.*.amount` is the
 * charge. The desk oracle must not replace it with token × rate.
 */
function fiatLockedTierAmount(period: MembershipBillingPeriod): number | null {
  const tiers = getSystemConfigSnapshot().membership?.tiers as
    | Record<string, { amount?: number; pricedInNativeToken?: boolean }>
    | undefined
  const row = tiers?.[period === 'yearly' ? 'memberAnnual' : 'member']
  if (!row || row.pricedInNativeToken !== false) return null
  return Number.isFinite(row.amount) ? Number(row.amount) : null
}

/** Live desk tier for the pay path — same shape as the sync tier, live amount. */
export async function getLiveMemberMainCurrencyTierForPeriod(
  period: MembershipBillingPeriod,
): Promise<MemberTierConfig> {
  const tier = getMemberMainCurrencyTierForPeriod(period)
  const locked = fiatLockedTierAmount(period)
  if (locked != null) return { ...tier, amount: locked }
  return {
    ...tier,
    amount: await getLiveMembershipMainCurrencyAmountForPeriod(period),
  }
}
