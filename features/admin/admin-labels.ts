import type { ModulesAdminLabels } from '@/components/wrappers/admin-wrapper'

type AdminTranslationFn = (key: string, ...args: unknown[]) => string

const safeLabel = (t: AdminTranslationFn, key: string): string | undefined => {
  try {
    const value = t(key)
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}

export const buildModulesAdminLabels = (t: AdminTranslationFn): ModulesAdminLabels => {
  return {
    dashboard: safeLabel(t, 'dashboard'),
    users: safeLabel(t, 'users'),
    news: safeLabel(t, 'news'),
    analytics: safeLabel(t, 'analytics'),
    moderation: safeLabel(t, 'moderation'),
    performance: safeLabel(t, 'performance'),
    security: safeLabel(t, 'security'),
    settings: safeLabel(t, 'settingsNav'),
    matcher: safeLabel(t, 'matcherNav'),
    verification: safeLabel(t, 'verificationNav'),
    store: safeLabel(t, 'store'),
    refcodes: safeLabel(t, 'refcodes'),
    emailInbox: safeLabel(t, 'emailInbox'),
    emailDrafts: safeLabel(t, 'emailDrafts'),
    emailContacts: safeLabel(t, 'emailContacts'),
    emailAnalytics: safeLabel(t, 'emailAnalytics'),
    emailTasks: safeLabel(t, 'emailTasks'),
    quickNav: safeLabel(t, 'quickNav'),
    navGroupOverview: safeLabel(t, 'navGroupOverview'),
    navGroupCommunity: safeLabel(t, 'navGroupCommunity'),
    navGroupPlatform: safeLabel(t, 'navGroupPlatform'),
    navGroupCommerce: safeLabel(t, 'navGroupCommerce'),
    navGroupEmail: safeLabel(t, 'navGroupEmail'),
    systemStats: safeLabel(t, 'systemStats'),
    totalUsers: safeLabel(t, 'totalUsers'),
    publishedArticles: safeLabel(t, 'publishedArticles'),
    activeUsers: safeLabel(t, 'activeUsers'),
    newUsers: safeLabel(t, 'newUsers'),
    uptime: safeLabel(t, 'uptime'),
    recentActivity: safeLabel(t, 'recentActivity'),
    viewAllActivity: safeLabel(t, 'viewAllActivity'),
    adminTools: safeLabel(t, 'adminTools'),
    contextualTools: safeLabel(t, 'contextualTools'),
    helpDocs: safeLabel(t, 'helpDocs'),
    adminHelpDescription: safeLabel(t, 'adminHelpDescription'),
    bulkImport: safeLabel(t, 'bulkImport'),
    exportData: safeLabel(t, 'exportData'),
    userReports: safeLabel(t, 'userReports'),
    bulkPublish: safeLabel(t, 'bulkPublish'),
    seoTools: safeLabel(t, 'seoTools'),
    contentModeration: safeLabel(t, 'contentModeration'),
    inventorySync: safeLabel(t, 'inventorySync'),
    orderManagement: safeLabel(t, 'orderManagement'),
    productAnalytics: safeLabel(t, 'productAnalytics'),
    systemBackup: safeLabel(t, 'systemBackup'),
    cacheClear: safeLabel(t, 'cacheClear'),
    viewLogs: safeLabel(t, 'viewLogs'),
    gettingStarted: safeLabel(t, 'gettingStarted'),
    apiReference: safeLabel(t, 'apiReference'),
    troubleshooting: safeLabel(t, 'troubleshooting')
  }
}
