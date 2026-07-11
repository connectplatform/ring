'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { filterAdminNavByRole } from '@/features/admin/admin-nav-config'
import { buildModulesAdminLabels, resolveAdminNavLabel } from '@/features/admin/admin-labels'
import { getAdminNavIconComponent } from '@/features/admin/admin-nav-icons'
import type { Locale } from '@/i18n/shared'
import { toAppHref } from '@/i18n/routing'

const DEFAULT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  news: 'News',
  dao: 'Public pools',
  analytics: 'Analytics',
  moderation: 'Moderation',
  security: 'Security',
  matcher: 'Matcher',
  store: 'Store',
  refcodes: 'Referral rewards',
  emailInbox: 'Email inbox',
  settings: 'Settings',
  processes: 'Processes',
  performance: 'Performance',
  subscriptions: 'Subscriptions',
  web3: 'Web3',
  web3Overview: 'Overview',
  web3Settings: 'Settings',
  web3Nft: 'NFT',
  web3NftMint: 'NFT mint',
  userManagement: 'User Management',
  navGroupOverview: 'Overview',
  navGroupCommunity: 'Community',
  navGroupTrust: 'Trust & safety',
  navGroupCommerce: 'Commerce',
  navGroupEmail: 'Email & CRM',
  navGroupPlatformOps: 'Platform',
}

export function useAdminNavMenu(role: unknown, locale: Locale) {
  const tAdmin = useTranslations('modules.admin')
  const labels = useMemo(
    () => buildModulesAdminLabels((key, ...args) => tAdmin(key as never, ...(args as never[]))),
    [tAdmin],
  )
  const groups = useMemo(() => filterAdminNavByRole(role), [role])

  const asideGroups = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        title: resolveAdminNavLabel(labels, group.titleKey, DEFAULT_LABELS[group.titleKey] ?? group.id),
        items: group.items.map((item) => ({
          id: item.id,
          hrefPath: item.href(locale),
          label: resolveAdminNavLabel(labels, item.labelKey, DEFAULT_LABELS[item.labelKey] ?? item.id),
          icon: getAdminNavIconComponent(item.icon),
          pageContext: item.pageContext,
        })),
      })),
    [groups, labels, locale],
  )

  const mobileItems = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          title: resolveAdminNavLabel(labels, item.labelKey, DEFAULT_LABELS[item.labelKey] ?? item.id),
          description: resolveAdminNavLabel(labels, group.titleKey, DEFAULT_LABELS[group.titleKey] ?? group.id),
          icon: getAdminNavIconComponent(item.icon),
          href: toAppHref(item.href(locale)) as string,
          iconBg: 'bg-red-500/20',
          iconColor: 'text-red-400',
        })),
      ),
    [groups, labels, locale],
  )

  return { asideGroups, mobileItems, groups, labels }
}
