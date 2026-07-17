import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'
import type { AdminNavLabelKey } from '@/features/admin/admin-nav-config'
import { resolveAdminNavMessage } from '@/features/admin/admin-nav-message-paths'

type AdminTranslationFn = (key: string, ...args: unknown[]) => string

const safeLabel = (t: AdminTranslationFn, key: string): string | undefined => {
  try {
    const value = t(key)
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

const navLabel = (t: AdminTranslationFn, labelKey: string) =>
  resolveAdminNavMessage(t, labelKey)

/** Resolve a nav/rail label from flat admin labels with English fallback. */
export function resolveAdminNavLabel(
  labels: ModulesAdminLabels,
  key: AdminNavLabelKey,
  fallback: string,
): string {
  const value = (labels as Record<string, string | undefined>)[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export const buildModulesAdminLabels = (t: AdminTranslationFn): ModulesAdminLabels => {
  return {
    dashboard: navLabel(t, 'dashboard'),
    users: navLabel(t, 'users'),
    rewards: safeLabel(t, 'rewards'),
    news: navLabel(t, 'news'),
    dao: navLabel(t, 'dao'),
    analytics: navLabel(t, 'analytics'),
    moderation: navLabel(t, 'moderation'),
    performance: navLabel(t, 'performance'),
    fraudDesk: navLabel(t, 'fraudDesk'),
    security: navLabel(t, 'security'),
    settings: navLabel(t, 'settings'),
    matcher: navLabel(t, 'matcher'),
    verification: navLabel(t, 'verification'),
    store: navLabel(t, 'store'),
    refcodes: navLabel(t, 'refcodes'),
    subscriptions: navLabel(t, 'subscriptions'),
    web3: navLabel(t, 'web3'),
    emailInbox: navLabel(t, 'emailInbox'),
    emailDrafts: safeLabel(t, 'emailDrafts'),
    emailContacts: safeLabel(t, 'emailContacts'),
    emailAnalytics: safeLabel(t, 'emailAnalytics'),
    emailTasks: safeLabel(t, 'emailTasks'),
    crmOrders: safeLabel(t, 'crmOrders') ?? 'Custom orders',
    processes: navLabel(t, 'processes'),
    userManagement: safeLabel(t, 'userManagement'),
    quickNav: safeLabel(t, 'quickNav'),
    relatedModules: safeLabel(t, 'relatedModules'),
    navGroupOverview: safeLabel(t, 'navGroupOverview'),
    navGroupCommunity: safeLabel(t, 'navGroupCommunity'),
    navGroupPlatform: safeLabel(t, 'navGroupPlatform'),
    navGroupTrust: safeLabel(t, 'navGroupTrust'),
    navGroupCommerce: safeLabel(t, 'navGroupCommerce'),
    navGroupEmail: safeLabel(t, 'navGroupEmail'),
    navGroupPlatformOps: safeLabel(t, 'navGroupPlatformOps'),
    newsManagement: safeLabel(t, 'newsManagement'),
    newsRailArticles: safeLabel(t, 'newsRailArticles'),
    newsRailCategories: safeLabel(t, 'newsRailCategories'),
    newsRailAnalytics: safeLabel(t, 'newsRailAnalytics'),
    newsRailBulk: safeLabel(t, 'newsRailBulk'),
    storeProducts: safeLabel(t, 'storeProducts'),
    storeOrders: safeLabel(t, 'storeOrders'),
    storeStock: safeLabel(t, 'storeStock'),
    storeCommissions: safeLabel(t, 'storeCommissions'),
    storeAddProduct: safeLabel(t, 'storeAddProduct'),
    daoPools: safeLabel(t, 'daoPools'),
    daoCreate: safeLabel(t, 'daoCreate'),
    securityTabOverview: safeLabel(t, 'securityHub.tabOverview'),
    securityTabFraud: safeLabel(t, 'securityHub.tabFraud'),
    securityTabVerification: safeLabel(t, 'securityHub.tabVerification'),
    securityTabEvents: safeLabel(t, 'securityHub.tabEvents'),
    matcherTabAnalytics: safeLabel(t, 'matcher.tabAnalytics'),
    matcherTabModeration: safeLabel(t, 'matcher.tabModeration'),
    moderationTabQueue: safeLabel(t, 'moderationTabQueue'),
    moderationTabRules: safeLabel(t, 'moderationTabRules'),
    moderationTabReports: safeLabel(t, 'moderationTabReports'),
    moderationTabAnalytics: safeLabel(t, 'moderationTabAnalytics'),
    usersTabOverview: safeLabel(t, 'usersTabOverview'),
    usersTabUsers: safeLabel(t, 'usersTabUsers'),
    usersTabVerification: safeLabel(t, 'usersTabVerification'),
    usersTabAnalytics: safeLabel(t, 'usersTabAnalytics'),
    web3Settings: safeLabel(t, 'web3Settings') ?? navLabel(t, 'web3Settings'),
    web3Overview: safeLabel(t, 'web3Overview') ?? navLabel(t, 'web3Overview'),
    web3Nft: safeLabel(t, 'web3Nft') ?? navLabel(t, 'web3Nft'),
    web3NftMint: safeLabel(t, 'web3NftMint') ?? navLabel(t, 'web3NftMint'),
    systemStats: safeLabel(t, 'systemStats'),
    newsStatsTotal: safeLabel(t, 'newsStatsTotal'),
    newsStatsPublished: safeLabel(t, 'newsStatsPublished'),
    newsStatsDrafts: safeLabel(t, 'newsStatsDrafts'),
    newsStatsArchived: safeLabel(t, 'newsStatsArchived'),
    newsStatsViews: safeLabel(t, 'newsStatsViews'),
    totalUsers: safeLabel(t, 'totalUsers'),
    publishedArticles: safeLabel(t, 'publishedArticles'),
    activeUsers: safeLabel(t, 'activeUsers'),
    newUsers: safeLabel(t, 'newUsers'),
    uptime: safeLabel(t, 'uptime'),
    recentActivity: safeLabel(t, 'recentActivity'),
    viewAllActivity: safeLabel(t, 'viewAllActivity'),
    helpDocs: safeLabel(t, 'helpDocs'),
    adminHelpDescription: safeLabel(t, 'adminHelpDescription'),
    gettingStarted: safeLabel(t, 'gettingStarted'),
    apiReference: safeLabel(t, 'apiReference'),
    troubleshooting: safeLabel(t, 'troubleshooting'),
  }
}
