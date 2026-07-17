import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  isPlatformAdmin,
  isSuperadmin,
  parseUserRolesArray,
  type UserRolesArray,
} from '@/features/auth/user-role'

/** AdminWrapper / right-rail page context identifiers.
 * Legacy aliases `fraud-desk` / `verification` map to the security rail
 * (redirect targets still resolve via resolveRailSection).
 */
export type AdminPageContext =
  | 'dashboard'
  | 'users'
  | 'rewards'
  | 'news'
  | 'dao'
  | 'analytics'
  | 'moderation'
  | 'performance'
  | 'security'
  | 'fraud-desk'
  | 'settings'
  | 'matcher'
  | 'verification'
  | 'store'
  | 'refcodes'
  | 'crm-inbox'
  | 'crm-drafts'
  | 'crm-contacts'
  | 'crm-analytics'
  | 'crm-tasks'
  | 'crm-orders'
  | 'processes'
  | 'subscriptions'
  | 'web3'

export type AdminMinRole = 'admin' | 'superadmin'

export type AdminNavIconKey =
  | 'BarChart3'
  | 'Users'
  | 'FileText'
  | 'Coins'
  | 'Shield'
  | 'TrendingUp'
  | 'ShieldAlert'
  | 'Database'
  | 'Settings'
  | 'Activity'
  | 'Archive'
  | 'CreditCard'
  | 'Mail'
  | 'ListTodo'
  | 'Zap'
  | 'Tags'
  | 'Plus'
  | 'Package'
  | 'ShoppingBag'
  | 'Wallet'

export type AdminNavLabelKey =
  | 'dashboard'
  | 'users'
  | 'rewards'
  | 'news'
  | 'dao'
  | 'analytics'
  | 'moderation'
  | 'security'
  | 'matcher'
  | 'store'
  | 'refcodes'
  | 'emailInbox'
  | 'settings'
  | 'processes'
  | 'performance'
  | 'subscriptions'
  | 'web3'
  | 'navGroupOverview'
  | 'navGroupCommunity'
  | 'navGroupTrust'
  | 'navGroupCommerce'
  | 'navGroupEmail'
  | 'navGroupPlatformOps'
  | 'newsManagement'
  | 'newsRailArticles'
  | 'newsRailCategories'
  | 'newsRailAnalytics'
  | 'newsRailBulk'
  | 'storeProducts'
  | 'storeOrders'
  | 'storeStock'
  | 'storeCommissions'
  | 'storeAddProduct'
  | 'daoPools'
  | 'daoCreate'
  | 'securityTabOverview'
  | 'securityTabFraud'
  | 'securityTabVerification'
  | 'securityTabEvents'
  | 'matcherTabAnalytics'
  | 'matcherTabModeration'
  | 'moderationTabQueue'
  | 'moderationTabRules'
  | 'moderationTabReports'
  | 'moderationTabAnalytics'
  | 'emailDrafts'
  | 'emailContacts'
  | 'emailAnalytics'
  | 'emailTasks'
  | 'crmOrders'
  | 'web3Settings'
  | 'web3Overview'
  | 'web3Nft'
  | 'web3NftMint'
  | 'usersTabOverview'
  | 'usersTabUsers'
  | 'usersTabVerification'
  | 'usersTabAnalytics'
  | 'userManagement'

export interface AdminNavItem {
  id: string
  labelKey: AdminNavLabelKey
  icon: AdminNavIconKey
  href: (locale: Locale) => string
  pageContext: AdminPageContext
  minRole: AdminMinRole
}

export interface AdminNavGroup {
  id: string
  titleKey: AdminNavLabelKey
  items: AdminNavItem[]
}

export interface AdminRailLink {
  id: string
  labelKey: AdminNavLabelKey
  href: (locale: Locale) => string
  icon?: AdminNavIconKey
  /** When set, used instead of exact href match for active state. */
  isActive?: (pathname: string) => boolean
  minRole?: AdminMinRole
}

/** Hub sections that show in-module submenu first in the right rail. */
export type AdminRailSectionId =
  | 'news'
  | 'store'
  | 'security'
  | 'email'
  | 'dao'
  | 'matcher'
  | 'web3'
  | 'users'
  | 'moderation'

export function canAccessAdminNavItem(role: UserRolesArray | null | undefined, minRole: AdminMinRole): boolean {
  if (!role || !isPlatformAdmin(role)) return false
  if (minRole === 'superadmin') return isSuperadmin(role)
  return true
}

export function filterAdminNavByRole(role: unknown): AdminNavGroup[] {
  const parsed = parseUserRolesArray(role)
  if (!parsed || !isPlatformAdmin(parsed)) return []

  return ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessAdminNavItem(parsed, item.minRole)),
  })).filter((group) => group.items.length > 0)
}

export function flattenAdminNavItems(groups: AdminNavGroup[]): AdminNavItem[] {
  return groups.flatMap((g) => g.items)
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'overview',
    titleKey: 'navGroupOverview',
    items: [
      {
        id: 'dashboard',
        labelKey: 'dashboard',
        icon: 'BarChart3',
        href: ROUTES.ADMIN,
        pageContext: 'dashboard',
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'community',
    titleKey: 'navGroupCommunity',
    items: [
      {
        id: 'users',
        labelKey: 'users',
        icon: 'Users',
        href: ROUTES.ADMIN_USERS,
        pageContext: 'users',
        minRole: 'admin',
      },
      {
        id: 'rewards',
        labelKey: 'rewards',
        icon: 'Coins',
        href: ROUTES.ADMIN_REWARDS,
        pageContext: 'rewards',
        minRole: 'admin',
      },
      {
        id: 'news',
        labelKey: 'news',
        icon: 'FileText',
        href: ROUTES.ADMIN_NEWS,
        pageContext: 'news',
        minRole: 'admin',
      },
      {
        id: 'dao',
        labelKey: 'dao',
        icon: 'Coins',
        href: ROUTES.ADMIN_DAO,
        pageContext: 'dao',
        minRole: 'admin',
      },
      {
        id: 'moderation',
        labelKey: 'moderation',
        icon: 'Shield',
        href: ROUTES.ADMIN_MODERATION,
        pageContext: 'moderation',
        minRole: 'admin',
      },
      {
        id: 'analytics',
        labelKey: 'analytics',
        icon: 'TrendingUp',
        href: ROUTES.ADMIN_ANALYTICS,
        pageContext: 'analytics',
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'trust',
    titleKey: 'navGroupTrust',
    items: [
      {
        id: 'security',
        labelKey: 'security',
        icon: 'ShieldAlert',
        href: ROUTES.ADMIN_SECURITY,
        pageContext: 'security',
        minRole: 'admin',
      },
      {
        id: 'matcher',
        labelKey: 'matcher',
        icon: 'Database',
        href: ROUTES.ADMIN_MATCHER,
        pageContext: 'matcher',
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'commerce',
    titleKey: 'navGroupCommerce',
    items: [
      {
        id: 'store',
        labelKey: 'store',
        icon: 'Archive',
        href: ROUTES.ADMIN_STORE_PRODUCTS,
        pageContext: 'store',
        minRole: 'admin',
      },
      {
        id: 'refcodes',
        labelKey: 'refcodes',
        icon: 'TrendingUp',
        href: ROUTES.ADMIN_REFCODES,
        pageContext: 'refcodes',
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'email',
    titleKey: 'navGroupEmail',
    items: [
      {
        id: 'crm-orders',
        labelKey: 'crmOrders',
        icon: 'ShoppingBag',
        href: ROUTES.ADMIN_CRM_ORDERS,
        pageContext: 'crm-orders',
        minRole: 'admin',
      },
      {
        id: 'crm-inbox',
        labelKey: 'emailInbox',
        icon: 'Mail',
        href: ROUTES.ADMIN_CRM_INBOX,
        pageContext: 'crm-inbox',
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'platform',
    titleKey: 'navGroupPlatformOps',
    items: [
      {
        id: 'settings',
        labelKey: 'settings',
        icon: 'Settings',
        href: ROUTES.ADMIN_SETTINGS,
        pageContext: 'settings',
        minRole: 'superadmin',
      },
      {
        id: 'processes',
        labelKey: 'processes',
        icon: 'Activity',
        href: ROUTES.ADMIN_PROCESSES,
        pageContext: 'processes',
        minRole: 'superadmin',
      },
      {
        id: 'performance',
        labelKey: 'performance',
        icon: 'Zap',
        href: ROUTES.ADMIN_PERFORMANCE,
        pageContext: 'performance',
        minRole: 'superadmin',
      },
      {
        id: 'subscriptions',
        labelKey: 'subscriptions',
        icon: 'CreditCard',
        href: ROUTES.ADMIN_SUBSCRIPTIONS,
        pageContext: 'subscriptions',
        minRole: 'superadmin',
      },
      {
        id: 'web3',
        labelKey: 'web3',
        icon: 'Wallet',
        href: ROUTES.ADMIN_WEB3,
        pageContext: 'web3',
        minRole: 'superadmin',
      },
    ],
  },
]

/** Maps pageContext to the rail section whose submenu should appear first. */
export function resolveRailSection(pageContext: AdminPageContext): AdminRailSectionId | null {
  switch (pageContext) {
    case 'news':
      return 'news'
    case 'store':
      return 'store'
    case 'security':
    case 'fraud-desk':
    case 'verification':
      return 'security'
    case 'crm-inbox':
    case 'crm-drafts':
    case 'crm-contacts':
    case 'crm-analytics':
    case 'crm-tasks':
    case 'crm-orders':
      return 'email'
    case 'dao':
      return 'dao'
    case 'matcher':
      return 'matcher'
    case 'web3':
      return 'web3'
    case 'users':
      return 'users'
    case 'moderation':
      return 'moderation'
    default:
      return null
  }
}

export function getRailSubmenu(
  sectionId: AdminRailSectionId,
  locale: Locale,
  pathname: string,
  role: UserRolesArray | null | undefined,
): AdminRailLink[] {
  const isSuper = role ? isSuperadmin(role) : false

  switch (sectionId) {
    case 'news':
      return [
        {
          id: 'articles',
          labelKey: 'newsRailArticles',
          href: ROUTES.ADMIN_NEWS,
          icon: 'FileText',
          isActive: (p) =>
            p.includes('/admin/news') &&
            !p.includes('/categories') &&
            !p.includes('/analytics') &&
            !p.includes('/bulk'),
        },
        {
          id: 'categories',
          labelKey: 'newsRailCategories',
          href: ROUTES.ADMIN_NEWS_CATEGORIES,
          icon: 'Tags',
          isActive: (p) => p.includes('/admin/news/categories'),
        },
        {
          id: 'analytics',
          labelKey: 'newsRailAnalytics',
          href: ROUTES.ADMIN_NEWS_ANALYTICS,
          icon: 'BarChart3',
          isActive: (p) => p.includes('/admin/news/analytics'),
        },
        {
          id: 'bulk',
          labelKey: 'newsRailBulk',
          href: ROUTES.ADMIN_NEWS_BULK,
          icon: 'Archive',
          isActive: (p) => p.includes('/admin/news/bulk'),
        },
      ]
    case 'store':
      return [
        {
          id: 'products',
          labelKey: 'storeProducts',
          href: ROUTES.ADMIN_STORE_PRODUCTS,
          icon: 'Package',
          isActive: (p) => p.includes('/admin/store/products') && !p.includes('/add'),
        },
        {
          id: 'orders',
          labelKey: 'storeOrders',
          href: ROUTES.ADMIN_STORE_ORDERS,
          icon: 'ShoppingBag',
          isActive: (p) => p.includes('/admin/store/orders'),
        },
        {
          id: 'stock',
          labelKey: 'storeStock',
          href: ROUTES.ADMIN_STORE_STOCK,
          icon: 'Archive',
          isActive: (p) => p.includes('/admin/store/stock'),
        },
        {
          id: 'commissions',
          labelKey: 'storeCommissions',
          href: ROUTES.ADMIN_STORE_COMMISSIONS,
          icon: 'TrendingUp',
          isActive: (p) => p.includes('/admin/store/commissions'),
        },
        {
          id: 'add-product',
          labelKey: 'storeAddProduct',
          href: ROUTES.ADMIN_STORE_PRODUCTS_ADD,
          icon: 'Plus',
          isActive: (p) => p.includes('/admin/store/products/add'),
        },
      ]
    case 'security': {
      const base = ROUTES.ADMIN_SECURITY(locale)
      return [
        {
          id: 'overview',
          labelKey: 'securityTabOverview',
          href: () => base,
          icon: 'ShieldAlert',
          isActive: (p) =>
            (p.includes('/admin/security') || p.includes('/admin/fraud-desk') || p.includes('/admin/verification')) &&
            !p.includes('tab=fraud') &&
            !p.includes('tab=verification') &&
            !p.includes('tab=events'),
        },
        {
          id: 'fraud',
          labelKey: 'securityTabFraud',
          href: () => `${base}?tab=fraud`,
          icon: 'ShieldAlert',
          isActive: (p) => p.includes('tab=fraud') || p.includes('/admin/fraud-desk'),
        },
        {
          id: 'verification',
          labelKey: 'securityTabVerification',
          href: () => `${base}?tab=verification`,
          icon: 'Shield',
          isActive: (p) =>
            (p.includes('/admin/security') && p.includes('tab=verification')) ||
            p.includes('/admin/verification'),
        },
        {
          id: 'events',
          labelKey: 'securityTabEvents',
          href: () => `${base}?tab=events`,
          icon: 'Activity',
          isActive: (p) => p.includes('tab=events'),
        },
      ]
    }
    case 'email':
      return [
        {
          id: 'crm-orders',
          labelKey: 'crmOrders',
          href: ROUTES.ADMIN_CRM_ORDERS,
          icon: 'ShoppingBag',
          isActive: (p) => p.includes('/admin/crm/orders'),
        },
        {
          id: 'inbox',
          labelKey: 'emailInbox',
          href: ROUTES.ADMIN_CRM_INBOX,
          icon: 'Mail',
          isActive: (p) => p.includes('/admin/crm/inbox'),
        },
        {
          id: 'drafts',
          labelKey: 'emailDrafts',
          href: ROUTES.ADMIN_CRM_DRAFTS,
          icon: 'FileText',
          isActive: (p) => p.includes('/admin/crm/drafts'),
        },
        {
          id: 'contacts',
          labelKey: 'emailContacts',
          href: ROUTES.ADMIN_CRM_CONTACTS,
          icon: 'Users',
          isActive: (p) => p.includes('/admin/crm/contacts'),
        },
        {
          id: 'analytics',
          labelKey: 'emailAnalytics',
          href: ROUTES.ADMIN_CRM_ANALYTICS,
          icon: 'BarChart3',
          isActive: (p) => p.includes('/admin/crm/analytics'),
        },
        {
          id: 'tasks',
          labelKey: 'emailTasks',
          href: ROUTES.ADMIN_CRM_TASKS,
          icon: 'ListTodo',
          isActive: (p) => p.includes('/admin/crm/tasks'),
        },
      ]
    case 'dao':
      return [
        {
          id: 'pools',
          labelKey: 'daoPools',
          href: ROUTES.ADMIN_DAO,
          icon: 'Coins',
          isActive: (p) => p.includes('/admin/dao') && !p.includes('/create') && !p.includes('/edit'),
        },
        {
          id: 'create',
          labelKey: 'daoCreate',
          href: ROUTES.ADMIN_DAO_CREATE,
          icon: 'Plus',
          isActive: (p) => p.includes('/admin/dao/create'),
        },
      ]
    case 'matcher':
      return [
        {
          id: 'analytics',
          labelKey: 'matcherTabAnalytics',
          href: ROUTES.ADMIN_MATCHER,
          icon: 'BarChart3',
          isActive: (p) => p.includes('/admin/matcher') && !p.includes('tab=moderation'),
        },
        {
          id: 'moderation',
          labelKey: 'matcherTabModeration',
          href: () => `${ROUTES.ADMIN_MATCHER(locale)}?tab=moderation`,
          icon: 'Shield',
          isActive: (p) => p.includes('tab=moderation'),
        },
      ]
    case 'web3':
      return [
        {
          id: 'overview',
          labelKey: 'web3Overview',
          href: ROUTES.ADMIN_WEB3,
          icon: 'Wallet',
          isActive: (p) =>
            p.includes('/admin/web3') &&
            !p.includes('/settings') &&
            !p.includes('/admin/nft'),
        },
        {
          id: 'nft',
          labelKey: 'web3Nft',
          href: ROUTES.ADMIN_NFT_TEMPLATES,
          icon: 'Tags',
          isActive: (p) =>
            p.includes('/admin/nft/templates') ||
            (p.includes('/admin/nft') && !p.includes('/mint')),
        },
        {
          id: 'nft-mint',
          labelKey: 'web3NftMint',
          href: ROUTES.ADMIN_NFT_MINT,
          icon: 'Plus',
          isActive: (p) => p.includes('/admin/nft/mint'),
        },
        ...(isSuper
          ? [
              {
                id: 'settings',
                labelKey: 'web3Settings' as AdminNavLabelKey,
                href: ROUTES.ADMIN_WEB3_SETTINGS,
                icon: 'Settings' as AdminNavIconKey,
                isActive: (p: string) => p.includes('/admin/web3/settings'),
                minRole: 'superadmin' as AdminMinRole,
              },
            ]
          : []),
      ]
    case 'users': {
      const base = ROUTES.ADMIN_USERS(locale)
      return [
        {
          id: 'overview',
          labelKey: 'usersTabOverview',
          href: () => base,
          icon: 'Users',
          isActive: (p) =>
            p.includes('/admin/users') &&
            !p.includes('tab=users') &&
            !p.includes('tab=verification') &&
            !p.includes('tab=analytics'),
        },
        {
          id: 'users-table',
          labelKey: 'usersTabUsers',
          href: () => `${base}?tab=users`,
          icon: 'Users',
          isActive: (p) => p.includes('tab=users'),
        },
        {
          id: 'verification',
          labelKey: 'usersTabVerification',
          href: () => `${base}?tab=verification`,
          icon: 'Shield',
          isActive: (p) => p.includes('/admin/users') && p.includes('tab=verification'),
        },
        {
          id: 'analytics',
          labelKey: 'usersTabAnalytics',
          href: () => `${base}?tab=analytics`,
          icon: 'BarChart3',
          isActive: (p) => p.includes('/admin/users') && p.includes('tab=analytics'),
        },
      ]
    }
    case 'moderation': {
      const base = ROUTES.ADMIN_MODERATION(locale)
      return [
        {
          id: 'queue',
          labelKey: 'moderationTabQueue',
          href: () => base,
          icon: 'Shield',
          isActive: (p) =>
            p.includes('/admin/moderation') &&
            !p.includes('tab=rules') &&
            !p.includes('tab=reports') &&
            !p.includes('tab=analytics'),
        },
        {
          id: 'rules',
          labelKey: 'moderationTabRules',
          href: () => `${base}?tab=rules`,
          icon: 'ListTodo',
          isActive: (p) => p.includes('/admin/moderation') && p.includes('tab=rules'),
        },
        {
          id: 'reports',
          labelKey: 'moderationTabReports',
          href: () => `${base}?tab=reports`,
          icon: 'FileText',
          isActive: (p) => p.includes('/admin/moderation') && p.includes('tab=reports'),
        },
        {
          id: 'analytics',
          labelKey: 'moderationTabAnalytics',
          href: () => `${base}?tab=analytics`,
          icon: 'BarChart3',
          isActive: (p) => p.includes('/admin/moderation') && p.includes('tab=analytics'),
        },
      ]
    }
    default:
      return []
  }
}

/** Related hub links shown below the in-module submenu. */
export function getRelatedHubs(
  pageContext: AdminPageContext,
  locale: Locale,
  role: UserRolesArray | null | undefined,
): AdminNavItem[] {
  const all = flattenAdminNavItems(filterAdminNavByRole(role ?? null))
  const byId = new Map(all.map((item) => [item.id, item]))

  const pick = (ids: string[]): AdminNavItem[] =>
    ids.map((id) => byId.get(id)).filter((item): item is AdminNavItem => Boolean(item))

  switch (pageContext) {
    case 'dashboard':
      return pick(['users', 'news', 'security', 'store', 'crm-inbox'])
    case 'users':
      // Include current module so Related modules shows active context.
      return pick(['users', 'rewards', 'security', 'moderation', 'analytics'])
    case 'rewards':
      return pick(['users', 'refcodes', 'subscriptions', 'analytics'])
    case 'news':
      return pick(['store', 'dao', 'analytics', 'moderation'])
    case 'dao':
      return pick(['users', 'store', 'web3'])
    case 'moderation':
      return pick(['news', 'security', 'matcher'])
    case 'analytics':
      return pick(['matcher', 'performance', 'crm-inbox'])
    case 'security':
    case 'fraud-desk':
    case 'verification':
      return pick(['users', 'matcher', 'moderation'])
    case 'matcher':
      return pick(['security', 'analytics'])
    case 'performance':
      return pick(['analytics', 'processes'])
    case 'settings':
      return pick(['processes', 'web3'])
    case 'processes':
      return pick(['settings', 'performance'])
    case 'store':
      return pick(['refcodes', 'subscriptions', 'dao'])
    case 'refcodes':
      return pick(['store', 'subscriptions'])
    case 'subscriptions':
      return pick(['store', 'refcodes'])
    case 'crm-inbox':
    case 'crm-drafts':
    case 'crm-contacts':
    case 'crm-analytics':
    case 'crm-tasks':
    case 'crm-orders':
      return pick(['users', 'analytics'])
    case 'web3':
      return pick(['dao', 'refcodes', 'settings'])
    default:
      return pick(['dashboard', 'users', 'news'])
  }
}

export function isRailLinkActive(link: AdminRailLink, pathWithQuery: string, href: string): boolean {
  if (link.isActive) return link.isActive(pathWithQuery)
  const pathOnly = pathWithQuery.split('?')[0] ?? pathWithQuery
  const hrefOnly = href.split('?')[0] ?? href
  return pathOnly === hrefOnly || pathOnly.startsWith(`${hrefOnly}/`)
}

export function getSectionTitleKey(sectionId: AdminRailSectionId): AdminNavLabelKey {
  switch (sectionId) {
    case 'news':
      return 'newsManagement'
    case 'store':
      return 'store'
    case 'security':
      return 'security'
    case 'email':
      return 'emailInbox'
    case 'dao':
      return 'dao'
    case 'matcher':
      return 'matcher'
    case 'web3':
      return 'web3'
    case 'users':
      return 'userManagement'
    case 'moderation':
      return 'moderation'
    default:
      return 'dashboard'
  }
}
