import {
  getCreditUnitToMainCurrencyRate,
  getMainCurrencySymbol,
  getNativeTokenSymbol,
  getSystemConfigSnapshot,
} from '@/lib/ring-config-core'
import { getCreditUnitPerNativeToken } from '@/lib/ring-config-chain'
import type { MemberTierConfig, MembershipTokenPricing } from '@/lib/ring-config-types'
import { UserRolesArray } from '@/features/auth/user-role'

const DEFAULT_RING_MEMBER_AMOUNT = 1
const ANNUAL_DISCOUNT = 0.8 // 20% off vs monthly × 12

/** Credit units at/above which we hint Token Desk swap instead of buy-credit. */
export const MEMBERSHIP_DESK_CREDIT_HINT_MIN = 10

export type MembershipBillingPeriod = 'monthly' | 'yearly'

/**
 * Runtime JSON uses `membership.ring`; types historically used `nativeToken`.
 * Alias both on read so pricing never silently falls back to 1.
 */
export function getMembershipTokenPricing(): MembershipTokenPricing {
  const membership = getSystemConfigSnapshot().membership as
    | {
        ring?: MembershipTokenPricing
        nativeToken?: MembershipTokenPricing
      }
    | undefined
  return (
    membership?.ring ??
    membership?.nativeToken ?? {
      memberUpgradeAmount: DEFAULT_RING_MEMBER_AMOUNT,
      subscriptionRenewalAmount: DEFAULT_RING_MEMBER_AMOUNT,
    }
  )
}

/** RING token cost for subscriber → member upgrade (monthly). SSOT: membership.ring.memberUpgradeAmount (1). */
export function getMembershipRingUpgradeAmount(): number {
  return getMembershipTokenPricing().memberUpgradeAmount ?? DEFAULT_RING_MEMBER_AMOUNT
}

/** RING token cost for monthly subscription renewal. */
export function getMembershipRingRenewalAmount(): number {
  const ring = getMembershipTokenPricing()
  return ring.subscriptionRenewalAmount ?? ring.memberUpgradeAmount ?? DEFAULT_RING_MEMBER_AMOUNT
}

/** Annual RING upgrade (config `annualUpgradeAmount` or 20% off monthly×12). */
export function getMembershipRingAnnualAmount(): number {
  const ring = getMembershipTokenPricing() as MembershipTokenPricing & {
    annualUpgradeAmount?: number
  }
  if (typeof ring.annualUpgradeAmount === 'number' && ring.annualUpgradeAmount > 0) {
    return ring.annualUpgradeAmount
  }
  return Math.round(getMembershipRingUpgradeAmount() * 12 * ANNUAL_DISCOUNT * 100) / 100
}

export function getMembershipRingAmountForPeriod(period: MembershipBillingPeriod): number {
  return period === 'yearly' ? getMembershipRingAnnualAmount() : getMembershipRingUpgradeAmount()
}

/**
 * Desk / oracle SSOT: main currency (`store.mainCurrency`) per 1 native token.
 * Prefer `exchangeRates[nativeSymbol]` when it stores main-per-native, else
 * `creditBalanceUnitPerNativeToken × creditBalanceUnitToMainCurrency` (100 × 0.1 = 10).
 *
 * Credit-balance is the core denomination: creditBalanceUnitPerNativeToken is credits per
 * 1 native; creditBalanceUnitToMainCurrency is main per 1 credit.
 */
export function getMembershipMainCurrencyPerNativeToken(): number {
  const rates = getSystemConfigSnapshot().exchangeRates as Record<string, number> | undefined
  const fromExchange = rates?.[getNativeTokenSymbol()]
  if (typeof fromExchange === 'number' && Number.isFinite(fromExchange) && fromExchange > 0) {
    return fromExchange
  }
  const ppt = getCreditUnitPerNativeToken()
  const unit = getCreditUnitToMainCurrencyRate()
  const derived = ppt * unit
  return Number.isFinite(derived) && derived > 0 ? derived : 10
}

/** Credit points for a RING amount: RING × credit.desk.creditBalanceUnitPerNativeToken (100:1). */
export function getMembershipCreditAmountForRing(ringAmount: number): number {
  const ppt = getCreditUnitPerNativeToken()
  return Math.round(ringAmount * (ppt > 0 ? ppt : 100) * 100) / 100
}

export function getMembershipCreditAmountForPeriod(period: MembershipBillingPeriod): number {
  return getMembershipCreditAmountForRing(getMembershipRingAmountForPeriod(period))
}

/** Fiat in store.mainCurrency for a RING amount (oracle / desk ratio). */
export function getMembershipMainCurrencyAmountForNative(ringAmount: number): number {
  return Math.round(ringAmount * getMembershipMainCurrencyPerNativeToken() * 100) / 100
}

export function getMembershipMainCurrencyAmountForPeriod(period: MembershipBillingPeriod): number {
  return getMembershipMainCurrencyAmountForNative(getMembershipRingAmountForPeriod(period))
}

/** Optional static tier row from ring-config (display cache / overrides). */
export function getMembershipTierConfig(
  role: UserRolesArray.member | UserRolesArray.subscriber,
): MemberTierConfig | null {
  const tiers = getSystemConfigSnapshot().membership?.tiers
  if (!tiers) return null
  return tiers[role] ?? null
}

/**
 * Member fiat tier — always derived from RING fee × desk/oracle ratios.
 * Config `membership.tiers.member` is a display cache; RING amount is SSOT.
 */
export function getMemberMainCurrencyTier(): MemberTierConfig {
  const currency = getMainCurrencySymbol()
  const ringAmount = getMembershipRingUpgradeAmount()
  const configured = getMembershipTierConfig(UserRolesArray.member)
  const amount = getMembershipMainCurrencyAmountForNative(ringAmount)
  return {
    amount,
    currency,
    description:
      configured?.description ||
      `Ring Platform Member Upgrade (${ringAmount} ${getNativeTokenSymbol()})`,
    duration: configured?.duration || '1 month',
  }
}

export function getMemberAnnualMainCurrencyTier(): MemberTierConfig {
  const currency = getMainCurrencySymbol()
  const ringAmount = getMembershipRingAnnualAmount()
  const configured = (
    getSystemConfigSnapshot().membership?.tiers as
      | Record<string, MemberTierConfig>
      | undefined
  )?.memberAnnual
  return {
    amount: getMembershipMainCurrencyAmountForNative(ringAmount),
    currency,
    description:
      configured?.description ||
      `Ring Platform Member Upgrade Annual (${ringAmount} ${getNativeTokenSymbol()})`,
    duration: configured?.duration || '1 year',
  }
}

export function getMemberMainCurrencyTierForPeriod(period: MembershipBillingPeriod): MemberTierConfig {
  return period === 'yearly' ? getMemberAnnualMainCurrencyTier() : getMemberMainCurrencyTier()
}

/**
 * Display price in the main currency. `Intl` owns symbol + fraction digits per
 * currency — no hardcoded symbol table, so any clone currency renders correctly.
 */
export function formatMembershipMainCurrencyAmount(
  tier: MemberTierConfig,
  locale?: string,
): string {
  const currency = String(tier.currency || getMainCurrencySymbol()).toUpperCase()
  const amount = Number(tier.amount)
  if (!Number.isFinite(amount)) return `${tier.amount} ${currency}`

  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

// Live desk (oracle-backed) pricing lives in `pricing-live.ts` — that module is
// server-only, so this one stays importable from client components.
