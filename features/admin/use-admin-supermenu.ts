'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  buildAdminSupermenuModel,
  labelOfAdminNav,
  type AdminSupermenuCopy,
} from '@/features/admin/build-admin-supermenu'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'
import type { Locale } from '@/i18n/shared'

export type {
  AdminSupermenuCopy,
  BuildAdminSupermenuInput,
  BuildAdminSupermenuResult,
  SupermenuEntry,
  SupermenuGroup,
  SupermenuIcon,
  SupermenuLeaf,
} from '@/features/admin/build-admin-supermenu'

export {
  buildAdminSupermenuModel,
  canonicalizeHref,
  collectSupermenuLeafHrefs,
  stripLocalePrefix,
} from '@/features/admin/build-admin-supermenu'

/**
 * Builds role-aware Admin supermenu as always-visible unique leaves.
 * Dashboard is returned separately for the title row (admin+ only).
 *
 * i18n notes:
 * - News copy lives at top-level `news` (from locales/.../modules/news.json), NOT `modules.news`.
 * - Admin nav labels live at `modules.admin` via buildModulesAdminLabels.
 * - Both modAdmin + modNews are in PUBLIC_HOME so this chrome works on every route.
 */
export function useAdminSupermenu(
  role: unknown,
  locale: Locale,
  options?: { hasVendor?: boolean },
) {
  const tAdmin = useTranslations('modules.admin')
  const tNav = useTranslations('navigation')
  // assembleMessages maps modNews → messages.news (not modules.news)
  const tNews = useTranslations('news')
  const hasVendor = Boolean(options?.hasVendor)

  const labels = useMemo(
    () => buildModulesAdminLabels((key, ...args) => tAdmin(key as never, ...(args as never[]))),
    [tAdmin],
  )

  const copy = useMemo<AdminSupermenuCopy>(
    () => ({
      contentTitle: tNav('sidebar.supermenuContent'),
      communityTitle: labelOfAdminNav(labels, 'navGroupCommunity', 'Community & Governance'),
      trustTitle: labelOfAdminNav(labels, 'navGroupTrust', 'Trust & Matching'),
      commerceTitle: labelOfAdminNav(labels, 'navGroupCommerce', 'Commerce'),
      emailTitle: labelOfAdminNav(labels, 'navGroupEmail', 'Email & CRM'),
      platformTitle: labelOfAdminNav(labels, 'navGroupPlatformOps', 'Platform'),
      platformStoreHeading: labelOfAdminNav(labels, 'store', 'Platform Store'),
      platformStoreProducts: labelOfAdminNav(labels, 'storeProducts', 'Products'),
      vendorHeading: tNav('sidebar.vendor'),
      myNews: tNews('myNews'),
      createArticle: tNews('createArticle'),
      vendorDashboard: tNav('sidebar.vendorDashboard'),
      vendorProducts: tNav('sidebar.vendorProducts'),
      vendorOrders: tNav('sidebar.vendorOrders'),
      vendorStock: tNav('sidebar.vendorStock'),
      vendorEarnings: tNav('sidebar.vendorEarnings'),
      vendorSettings: tNav('sidebar.vendorSettings'),
      // Scoped disambiguators when rail locale strings are generic ("Analytics")
      newsAnalytics:
        labelOfAdminNav(labels, 'newsRailAnalytics', 'Analytics') === 'Analytics'
          ? 'News Analytics'
          : labelOfAdminNav(labels, 'newsRailAnalytics', 'News Analytics'),
      bulkPublishing: labelOfAdminNav(labels, 'newsRailBulk', 'Bulk Publishing'),
      moderationAnalytics:
        labelOfAdminNav(labels, 'moderationTabAnalytics', 'Analytics') === 'Analytics'
          ? 'Moderation Analytics'
          : labelOfAdminNav(labels, 'moderationTabAnalytics', 'Moderation Analytics'),
      moderationQueue: labelOfAdminNav(labels, 'moderationTabQueue', 'Moderation Queue'),
      matcherAnalytics:
        labelOfAdminNav(labels, 'matcherTabAnalytics', 'Analytics') === 'Analytics'
          ? 'Matcher Analytics'
          : labelOfAdminNav(labels, 'matcherTabAnalytics', 'Matcher Analytics'),
      matcherModeration: labelOfAdminNav(labels, 'matcherTabModeration', 'Matcher Moderation'),
      emailAnalytics: labelOfAdminNav(labels, 'emailAnalytics', 'Email Analytics'),
      platformAnalytics: labelOfAdminNav(labels, 'analytics', 'Platform Analytics'),
      web3Overview: labelOfAdminNav(labels, 'web3Overview', 'Web3 Overview'),
      nftTemplates: labelOfAdminNav(labels, 'web3Nft', 'NFT Templates'),
      nftMint: labelOfAdminNav(labels, 'web3NftMint', 'NFT Mint'),
      web3Settings: labelOfAdminNav(labels, 'web3Settings', 'Web3 Settings'),
    }),
    [labels, tNav, tNews],
  )

  const model = useMemo(
    () =>
      buildAdminSupermenuModel({
        role,
        locale,
        hasVendor,
        labels,
        copy,
      }),
    [copy, hasVendor, labels, locale, role],
  )

  return {
    groups: model.groups,
    dashboardItem: model.dashboardItem,
    isMemberPlus: model.isMemberPlus,
    isAdmin: model.isAdmin,
    hasContent: model.groups.length > 0 || Boolean(model.dashboardItem),
  }
}
