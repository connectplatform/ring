import type { ComponentType } from 'react'
import {
  BarChart3,
  DollarSign,
  FilePlus,
  FileText,
  Package,
  Settings,
  ShoppingBag,
} from 'lucide-react'
import {
  getRailSubmenu,
  type AdminNavLabelKey,
  type AdminRailLink,
} from '@/features/admin/admin-nav-config'
import { buildModulesAdminLabels, resolveAdminNavLabel } from '@/features/admin/admin-labels'
import { getAdminNavIconComponent } from '@/features/admin/admin-nav-icons'
import { canCreateNewsArticle } from '@/features/news/lib/news-permissions'
import {
  hasMemberPrivileges,
  isPlatformAdmin,
  isSuperadmin,
  parseUserRolesArray,
  type UserRolesArray,
} from '@/features/auth/user-role'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'

export type SupermenuIcon = ComponentType<{ className?: string; strokeWidth?: number }>

export type SupermenuLeaf = {
  id: string
  label: string
  href: string
  icon: SupermenuIcon
  /** Active matcher evaluated against pathname + search (no hash). */
  isActive?: (pathWithQuery: string) => boolean
}

export type SupermenuEntry =
  | ({ kind: 'link' } & SupermenuLeaf)
  | { kind: 'heading'; id: string; label: string }

export type SupermenuGroup = {
  id: string
  title: string
  entries: SupermenuEntry[]
}

export type AdminSupermenuCopy = {
  contentTitle: string
  communityTitle: string
  trustTitle: string
  commerceTitle: string
  emailTitle: string
  platformTitle: string
  platformStoreHeading: string
  platformStoreProducts: string
  vendorHeading: string
  myNews: string
  createArticle: string
  vendorDashboard: string
  vendorProducts: string
  vendorOrders: string
  vendorStock: string
  vendorEarnings: string
  vendorSettings: string
  newsAnalytics: string
  bulkPublishing: string
  moderationAnalytics: string
  moderationQueue: string
  matcherAnalytics: string
  matcherModeration: string
  emailAnalytics: string
  platformAnalytics: string
  web3Overview: string
  nftTemplates: string
  nftMint: string
  web3Settings: string
}

const DEFAULT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  news: 'News',
  wiki: 'Wiki',
  dao: 'Public pools',
  analytics: 'Platform Analytics',
  moderation: 'Moderation',
  security: 'Security',
  matcher: 'Matcher',
  store: 'Store',
  refcodes: 'Referral rewards',
  rewards: 'Rewards',
  emailInbox: 'Email inbox',
  settings: 'Settings',
  processes: 'Processes',
  performance: 'Performance',
  subscriptions: 'Subscriptions',
  web3: 'Web3',
  web3Overview: 'Web3 Overview',
  web3Settings: 'Web3 Settings',
  web3Nft: 'NFT Templates',
  web3NftMint: 'NFT Mint',
  userManagement: 'Users',
  navGroupEmail: 'Email & CRM',
  navGroupPlatformOps: 'Platform',
  newsRailArticles: 'Articles',
  newsRailCategories: 'Categories',
  newsRailAnalytics: 'News Analytics',
  newsRailBulk: 'Bulk Publishing',
  storeProducts: 'Products',
  storeOrders: 'Orders',
  storeStock: 'Stock',
  storeCommissions: 'Commissions',
  storeAddProduct: 'Add Product',
  daoPools: 'Public Pools',
  daoCreate: 'Create Pool',
  securityTabOverview: 'Security Overview',
  securityTabFraud: 'Fraud',
  securityTabVerification: 'Verification',
  securityTabEvents: 'Security Events',
  matcherTabAnalytics: 'Matcher Analytics',
  matcherTabModeration: 'Matcher Moderation',
  moderationTabQueue: 'Moderation Queue',
  moderationTabRules: 'Rules',
  moderationTabReports: 'Reports',
  moderationTabAnalytics: 'Moderation Analytics',
  emailDrafts: 'Drafts',
  emailContacts: 'Contacts',
  emailAnalytics: 'Email Analytics',
  emailTasks: 'Tasks',
  usersTabOverview: 'User Overview',
  usersTabUsers: 'User Directory',
  usersTabVerification: 'User Verification',
  usersTabAnalytics: 'User Analytics',
}

/** Mirror of i18n/routing.toAppHref without pulling next-intl into unit tests. */
export function stripLocalePrefix(href: string): string {
  const match = href.match(/^\/(en|uk|ru)(?=\/|$)/)
  return match ? href.slice(match[0].length) || '/' : href
}

/** Canonical key for destination dedupe: path + sorted query (no hash). */
export function canonicalizeHref(href: string): string {
  try {
    const url = new URL(href, 'http://local.invalid')
    const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
    const qs = params.length
      ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : ''
    return `${url.pathname.replace(/\/$/, '') || '/'}${qs}`
  } catch {
    return href.split('#')[0] ?? href
  }
}

export function labelOfAdminNav(
  labels: ReturnType<typeof buildModulesAdminLabels>,
  key: string,
  fallback?: string,
): string {
  return resolveAdminNavLabel(
    labels,
    key as AdminNavLabelKey,
    fallback ?? DEFAULT_LABELS[key] ?? key,
  )
}

function pushLink(out: SupermenuEntry[], seen: Set<string>, leaf: SupermenuLeaf): void {
  const key = canonicalizeHref(leaf.href)
  if (seen.has(key)) return
  seen.add(key)
  out.push({ kind: 'link', ...leaf })
}

function railLinksToEntries(
  links: AdminRailLink[],
  locale: Locale,
  labels: ReturnType<typeof buildModulesAdminLabels>,
  seen: Set<string>,
  headingId: string,
  headingLabel: string,
  labelOverrides?: Partial<Record<string, string>>,
  includeHeading = true,
): SupermenuEntry[] {
  const out: SupermenuEntry[] = includeHeading
    ? [{ kind: 'heading', id: headingId, label: headingLabel }]
    : []
  for (const link of links) {
    const href = stripLocalePrefix(link.href(locale))
    const key = canonicalizeHref(href)
    if (seen.has(key)) continue
    seen.add(key)
    const Icon = link.icon ? getAdminNavIconComponent(link.icon) : FileText
    out.push({
      kind: 'link',
      id: `${headingId}-${link.id}`,
      label:
        labelOverrides?.[link.id] ??
        labelOfAdminNav(labels, link.labelKey, DEFAULT_LABELS[link.labelKey]),
      href,
      icon: Icon,
      isActive: link.isActive,
    })
  }
  return out
}

export type BuildAdminSupermenuInput = {
  role: unknown
  locale: Locale
  hasVendor?: boolean
  labels: ReturnType<typeof buildModulesAdminLabels>
  copy: AdminSupermenuCopy
}

export type BuildAdminSupermenuResult = {
  groups: SupermenuGroup[]
  dashboardItem: SupermenuLeaf | null
  isMemberPlus: boolean
  isAdmin: boolean
  isSuper: boolean
}

/** Pure builder — unit-testable without React / next-intl. */
export function buildAdminSupermenuModel({
  role,
  locale,
  hasVendor = false,
  labels,
  copy,
}: BuildAdminSupermenuInput): BuildAdminSupermenuResult {
  const parsed = parseUserRolesArray(role)
  const isMemberPlus = hasMemberPrivileges(parsed)
  const isAdmin = isPlatformAdmin(parsed)
  const isSuper = isSuperadmin(parsed)
  const canCreateNews = canCreateNewsArticle(parsed)

  if (!isMemberPlus) {
    return { groups: [], dashboardItem: null, isMemberPlus, isAdmin, isSuper }
  }

  const seen = new Set<string>()
  const groupsOut: SupermenuGroup[] = []
  const roleTyped = parsed as UserRolesArray | null

  // --- Content & Blog ---
  {
    const entries: SupermenuEntry[] = []
    if (canCreateNews) {
      pushLink(entries, seen, {
        id: 'my-news',
        label: copy.myNews,
        href: stripLocalePrefix(ROUTES.MY_NEWS(locale)),
        icon: FileText,
      })
      pushLink(entries, seen, {
        id: 'create-article',
        label: copy.createArticle,
        href: stripLocalePrefix(ROUTES.NEWS_CREATE(locale)),
        icon: FilePlus,
      })
    }
    if (isAdmin && roleTyped) {
      entries.push(
        ...railLinksToEntries(
          getRailSubmenu('news', locale, ROUTES.ADMIN_NEWS(locale), roleTyped),
          locale,
          labels,
          seen,
          'news',
          labelOfAdminNav(labels, 'news', 'News'),
          {
            // Prefer locale rail labels; only disambiguate flat "Analytics" when needed.
            analytics: copy.newsAnalytics,
            bulk: copy.bulkPublishing,
          },
          true,
        ),
      )
      pushLink(entries, seen, {
        id: 'admin-wiki',
        label: labelOfAdminNav(labels, 'wiki', 'Wiki'),
        href: stripLocalePrefix(ROUTES.ADMIN_WIKI(locale)),
        icon: getAdminNavIconComponent('Database'),
      })
    }
    if (entries.some((e) => e.kind === 'link')) {
      groupsOut.push({ id: 'content', title: copy.contentTitle, entries })
    }
  }

  // --- Community & Governance ---
  if (isAdmin && roleTyped) {
    const entries: SupermenuEntry[] = []
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('users', locale, ROUTES.ADMIN_USERS(locale), roleTyped),
        locale,
        labels,
        seen,
        'users',
        labelOfAdminNav(labels, 'userManagement', 'Users'),
      ),
    )
    pushLink(entries, seen, {
      id: 'rewards',
      label: labelOfAdminNav(labels, 'rewards', 'Rewards'),
      href: stripLocalePrefix(ROUTES.ADMIN_REWARDS(locale)),
      icon: getAdminNavIconComponent('Coins'),
    })
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('dao', locale, ROUTES.ADMIN_DAO(locale), roleTyped),
        locale,
        labels,
        seen,
        'dao',
        labelOfAdminNav(labels, 'dao', 'Public pools'),
      ),
    )
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('moderation', locale, ROUTES.ADMIN_MODERATION(locale), roleTyped),
        locale,
        labels,
        seen,
        'moderation',
        labelOfAdminNav(labels, 'moderation', 'Moderation'),
        {
          analytics: copy.moderationAnalytics,
          queue: copy.moderationQueue,
        },
      ),
    )
    pushLink(entries, seen, {
      id: 'platform-analytics',
      label: copy.platformAnalytics,
      href: stripLocalePrefix(ROUTES.ADMIN_ANALYTICS(locale)),
      icon: getAdminNavIconComponent('TrendingUp'),
    })
    if (entries.some((e) => e.kind === 'link')) {
      groupsOut.push({ id: 'community', title: copy.communityTitle, entries })
    }
  }

  // --- Trust & Matching ---
  if (isAdmin && roleTyped) {
    const entries: SupermenuEntry[] = []
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('security', locale, ROUTES.ADMIN_SECURITY(locale), roleTyped),
        locale,
        labels,
        seen,
        'security',
        labelOfAdminNav(labels, 'security', 'Security'),
      ),
    )
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('matcher', locale, ROUTES.ADMIN_MATCHER(locale), roleTyped),
        locale,
        labels,
        seen,
        'matcher',
        labelOfAdminNav(labels, 'matcher', 'Matcher'),
        {
          analytics: copy.matcherAnalytics,
          moderation: copy.matcherModeration,
        },
      ),
    )
    if (entries.some((e) => e.kind === 'link')) {
      groupsOut.push({ id: 'trust', title: copy.trustTitle, entries })
    }
  }

  // --- Commerce ---
  {
    const entries: SupermenuEntry[] = []
    if (isAdmin && roleTyped) {
      entries.push(
        ...railLinksToEntries(
          getRailSubmenu('store', locale, ROUTES.ADMIN_STORE_PRODUCTS(locale), roleTyped),
          locale,
          labels,
          seen,
          'admin-store',
          copy.platformStoreHeading,
          { products: copy.platformStoreProducts },
        ),
      )
      pushLink(entries, seen, {
        id: 'admin-refcodes',
        label: labelOfAdminNav(labels, 'refcodes', 'Referral rewards'),
        href: stripLocalePrefix(ROUTES.ADMIN_REFCODES(locale)),
        icon: getAdminNavIconComponent('TrendingUp'),
      })
    }
    if (hasVendor) {
      entries.push({ kind: 'heading', id: 'vendor-heading', label: copy.vendorHeading })
      const vendorItems: SupermenuLeaf[] = [
        {
          id: 'vendor-dashboard',
          label: copy.vendorDashboard,
          href: stripLocalePrefix(ROUTES.VENDOR_DASHBOARD(locale)),
          icon: BarChart3,
        },
        {
          id: 'vendor-products',
          label: copy.vendorProducts,
          href: stripLocalePrefix(ROUTES.VENDOR_PRODUCTS(locale)),
          icon: Package,
        },
        {
          id: 'vendor-orders',
          label: copy.vendorOrders,
          href: stripLocalePrefix(ROUTES.VENDOR_ORDERS(locale)),
          icon: ShoppingBag,
        },
        {
          id: 'vendor-stock',
          label: copy.vendorStock,
          href: stripLocalePrefix(ROUTES.VENDOR_STOCK(locale)),
          icon: Package,
        },
        {
          id: 'vendor-earnings',
          label: copy.vendorEarnings,
          href: stripLocalePrefix(ROUTES.VENDOR_EARNINGS(locale)),
          icon: DollarSign,
        },
        {
          id: 'vendor-settings',
          label: copy.vendorSettings,
          href: stripLocalePrefix(ROUTES.VENDOR_SETTINGS(locale)),
          icon: Settings,
        },
      ]
      for (const item of vendorItems) pushLink(entries, seen, item)
    }
    if (entries.some((e) => e.kind === 'link')) {
      groupsOut.push({ id: 'commerce', title: copy.commerceTitle, entries })
    }
  }

  // --- Email & CRM ---
  if (isAdmin && roleTyped) {
    const entries: SupermenuEntry[] = []
    pushLink(entries, seen, {
      id: 'crm-orders',
      label: labelOfAdminNav(labels, 'crmOrders', 'Custom orders'),
      href: stripLocalePrefix(ROUTES.ADMIN_CRM_ORDERS(locale)),
      icon: ShoppingBag,
    })
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('email', locale, ROUTES.ADMIN_CRM_INBOX(locale), roleTyped),
        locale,
        labels,
        seen,
        'email',
        copy.emailTitle,
        { analytics: copy.emailAnalytics },
        false,
      ),
    )
    if (entries.some((e) => e.kind === 'link')) {
      groupsOut.push({ id: 'email', title: copy.emailTitle, entries })
    }
  }

  // --- Platform (superadmin) ---
  if (isSuper && roleTyped) {
    const entries: SupermenuEntry[] = []
    pushLink(entries, seen, {
      id: 'settings',
      label: labelOfAdminNav(labels, 'settings', 'Settings'),
      href: stripLocalePrefix(ROUTES.ADMIN_SETTINGS(locale)),
      icon: getAdminNavIconComponent('Settings'),
    })
    pushLink(entries, seen, {
      id: 'processes',
      label: labelOfAdminNav(labels, 'processes', 'Processes'),
      href: stripLocalePrefix(ROUTES.ADMIN_PROCESSES(locale)),
      icon: getAdminNavIconComponent('Activity'),
    })
    pushLink(entries, seen, {
      id: 'performance',
      label: labelOfAdminNav(labels, 'performance', 'Performance'),
      href: stripLocalePrefix(ROUTES.ADMIN_PERFORMANCE(locale)),
      icon: getAdminNavIconComponent('Zap'),
    })
    pushLink(entries, seen, {
      id: 'subscriptions',
      label: labelOfAdminNav(labels, 'subscriptions', 'Subscriptions'),
      href: stripLocalePrefix(ROUTES.ADMIN_SUBSCRIPTIONS(locale)),
      icon: getAdminNavIconComponent('CreditCard'),
    })
    entries.push(
      ...railLinksToEntries(
        getRailSubmenu('web3', locale, ROUTES.ADMIN_WEB3(locale), roleTyped),
        locale,
        labels,
        seen,
        'web3',
        labelOfAdminNav(labels, 'web3', 'Web3'),
        {
          overview: copy.web3Overview,
          nft: copy.nftTemplates,
          'nft-mint': copy.nftMint,
          settings: copy.web3Settings,
        },
      ),
    )
    if (entries.some((e) => e.kind === 'link')) {
      groupsOut.push({ id: 'platform', title: copy.platformTitle, entries })
    }
  }

  const dashboardItem: SupermenuLeaf | null = isAdmin
    ? {
        id: 'dashboard',
        label: labelOfAdminNav(labels, 'dashboard', 'Dashboard'),
        href: stripLocalePrefix(ROUTES.ADMIN(locale)),
        icon: BarChart3,
        isActive: (p) => {
          const path = (p.split('?')[0] ?? p).replace(/\/$/, '') || '/'
          return /\/admin$/.test(path)
        },
      }
    : null

  return { groups: groupsOut, dashboardItem, isMemberPlus, isAdmin, isSuper }
}

/** Collect unique leaf hrefs from a built model (tests). */
export function collectSupermenuLeafHrefs(groups: SupermenuGroup[]): string[] {
  return groups.flatMap((g) =>
    g.entries
      .filter((e): e is Extract<SupermenuEntry, { kind: 'link' }> => e.kind === 'link')
      .map((e) => e.href),
  )
}
