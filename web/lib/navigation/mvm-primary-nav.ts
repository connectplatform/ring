/**
 * MVM (multi-vendor marketplace) primary nav — Tier-2 when `home.preset = "mvm-landing"`.
 * GreenFood / agricultural store clones: Market · Sellers · (+) · Group Buy · Account.
 */
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

export const MVM_GROUP_BUY_TYPES = 'collective_order'

export function mvmGroupBuyHref(locale: Locale): string {
  return `${ROUTES.OPPORTUNITIES(locale)}?types=${MVM_GROUP_BUY_TYPES}`
}

export type MvmNavLabelKey =
  | 'mainNav.marketplace'
  | 'mainNav.sellers'
  | 'mainNav.groupBuy'
  | 'mainNav.account'
  | 'store'
  | 'entities'
  | 'profile'

export type MvmPrimaryNavId = 'store' | 'entities' | 'groupBuy' | 'account'

export type MvmPrimaryNavSpec = {
  id: MvmPrimaryNavId
  href: string
  /** Prefer mainNav.*; fallback keys listed for older locale packs. */
  labelKeys: MvmNavLabelKey[]
}

export function getMvmPrimaryNavSpecs(locale: Locale): MvmPrimaryNavSpec[] {
  return [
    {
      id: 'store',
      href: ROUTES.STORE(locale),
      labelKeys: ['mainNav.marketplace', 'store'],
    },
    {
      id: 'entities',
      href: ROUTES.ENTITIES(locale),
      labelKeys: ['mainNav.sellers', 'entities'],
    },
    {
      id: 'groupBuy',
      href: mvmGroupBuyHref(locale),
      labelKeys: ['mainNav.groupBuy'],
    },
    {
      id: 'account',
      href: ROUTES.PROFILE(locale),
      labelKeys: ['mainNav.account', 'profile'],
    },
  ]
}

export function resolveNavLabel(
  t: (key: string) => string,
  keys: MvmNavLabelKey[],
): string {
  for (const key of keys) {
    try {
      const value = t(key)
      if (value && value !== key) return value
    } catch {
      /* missing key */
    }
  }
  return keys[0] ?? ''
}
