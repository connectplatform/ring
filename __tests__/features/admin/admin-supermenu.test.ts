import {
  buildAdminSupermenuModel,
  canonicalizeHref,
  collectSupermenuLeafHrefs,
  type AdminSupermenuCopy,
} from '@/features/admin/build-admin-supermenu'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels'

const copy: AdminSupermenuCopy = {
  contentTitle: 'Content & Blog',
  communityTitle: 'Community & Governance',
  trustTitle: 'Trust & Matching',
  commerceTitle: 'Commerce',
  emailTitle: 'Email & CRM',
  platformTitle: 'Platform',
  platformStoreHeading: 'Platform Store',
  platformStoreProducts: 'Platform Store Products',
  vendorHeading: 'My Vendor Store',
  myNews: 'My News',
  createArticle: 'Create Article',
  vendorDashboard: 'Vendor Dashboard',
  vendorProducts: 'Vendor Products',
  vendorOrders: 'Vendor Orders',
  vendorStock: 'Vendor Stock',
  vendorEarnings: 'Vendor Earnings',
  vendorSettings: 'Vendor Settings',
  newsAnalytics: 'News Analytics',
  bulkPublishing: 'Bulk Publishing',
  moderationAnalytics: 'Moderation Analytics',
  moderationQueue: 'Moderation Queue',
  matcherAnalytics: 'Matcher Analytics',
  matcherModeration: 'Matcher Moderation',
  emailAnalytics: 'Email Analytics',
  platformAnalytics: 'Platform Analytics',
  web3Overview: 'Web3 Overview',
  nftTemplates: 'NFT Templates',
  nftMint: 'NFT Mint',
  web3Settings: 'Web3 Settings',
}

const labels = buildModulesAdminLabels((key) => key)

function build(role: string, opts?: { hasVendor?: boolean }) {
  return buildAdminSupermenuModel({
    role,
    locale: 'en',
    hasVendor: opts?.hasVendor,
    labels,
    copy,
  })
}

function leafIds(groups: ReturnType<typeof build>['groups']) {
  return groups.flatMap((g) =>
    g.entries.filter((e) => e.kind === 'link').map((e) => (e.kind === 'link' ? e.id : '')),
  )
}

function leafLabelsInGroup(
  groups: ReturnType<typeof build>['groups'],
  groupId: string,
) {
  const group = groups.find((g) => g.id === groupId)
  if (!group) return []
  return group.entries
    .filter((e) => e.kind === 'link')
    .map((e) => (e.kind === 'link' ? e.label : ''))
}

describe('canonicalizeHref', () => {
  it('dedupes by path + sorted query', () => {
    expect(canonicalizeHref('/en/admin/security?tab=fraud&x=1')).toBe(
      canonicalizeHref('/en/admin/security?x=1&tab=fraud'),
    )
    expect(canonicalizeHref('/en/admin/users/')).toBe('/en/admin/users')
  })
})

describe('buildAdminSupermenuModel', () => {
  it('returns empty for visitors', () => {
    const model = build('visitor')
    expect(model.groups).toEqual([])
    expect(model.dashboardItem).toBeNull()
    expect(model.isMemberPlus).toBe(false)
  })

  it('gives members Content & Blog without Dashboard', () => {
    const model = build('member')
    expect(model.dashboardItem).toBeNull()
    expect(model.groups.map((g) => g.id)).toEqual(['content'])
    expect(leafLabelsInGroup(model.groups, 'content')).toEqual(
      expect.arrayContaining(['My News', 'Create Article']),
    )
    expect(model.groups.some((g) => g.id === 'community')).toBe(false)
  })

  it('adds vendor subsection for vendor-members', () => {
    const model = build('member', { hasVendor: true })
    expect(model.groups.map((g) => g.id)).toEqual(expect.arrayContaining(['content', 'commerce']))
    expect(leafIds(model.groups)).toEqual(
      expect.arrayContaining(['vendor-dashboard', 'vendor-products']),
    )
  })

  it('places Dashboard outside grid groups for admins', () => {
    const model = build('admin')
    expect(model.dashboardItem?.id).toBe('dashboard')
    expect(model.dashboardItem?.href).toContain('/admin')
    const hrefs = collectSupermenuLeafHrefs(model.groups).map(canonicalizeHref)
    expect(hrefs).not.toContain(canonicalizeHref(model.dashboardItem!.href))
    expect(model.groups.some((g) => g.id === 'overview')).toBe(false)
  })

  it('keeps all News routes under Content & Blog (not Community)', () => {
    const model = build('admin')
    const contentHrefs = collectSupermenuLeafHrefs(
      model.groups.filter((g) => g.id === 'content'),
    )
    expect(contentHrefs.some((h) => h.includes('/admin/news'))).toBe(true)
    const communityHrefs = collectSupermenuLeafHrefs(
      model.groups.filter((g) => g.id === 'community'),
    )
    expect(communityHrefs.some((h) => h.includes('/admin/news'))).toBe(false)
  })

  it('ensures unique canonical destinations', () => {
    const model = build('superadmin', { hasVendor: true })
    const hrefs = collectSupermenuLeafHrefs(model.groups).map(canonicalizeHref)
    if (model.dashboardItem) hrefs.push(canonicalizeHref(model.dashboardItem.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('gates Platform group to superadmin', () => {
    expect(build('admin').groups.some((g) => g.id === 'platform')).toBe(false)
    const superModel = build('superadmin')
    expect(superModel.groups.some((g) => g.id === 'platform')).toBe(true)
    expect(leafIds(superModel.groups)).toEqual(
      expect.arrayContaining(['settings', 'processes', 'web3-overview']),
    )
  })

  it('preserves query-tab active matchers independently', () => {
    const model = build('admin')
    const trust = model.groups.find((g) => g.id === 'trust')
    expect(trust).toBeTruthy()
    const fraud = trust!.entries.find(
      (e) => e.kind === 'link' && e.id === 'security-fraud',
    )
    const overview = trust!.entries.find(
      (e) => e.kind === 'link' && e.id === 'security-overview',
    )
    expect(fraud && fraud.kind === 'link' && fraud.isActive).toBeTruthy()
    expect(overview && overview.kind === 'link' && overview.isActive).toBeTruthy()
    if (fraud?.kind === 'link' && overview?.kind === 'link') {
      const fraudPath = '/en/admin/security?tab=fraud'
      const overviewPath = '/en/admin/security'
      expect(fraud.isActive!(fraudPath)).toBe(true)
      expect(overview.isActive!(fraudPath)).toBe(false)
      expect(overview.isActive!(overviewPath)).toBe(true)
      expect(fraud.isActive!(overviewPath)).toBe(false)
    }

    const community = model.groups.find((g) => g.id === 'community')
    const usersAnalytics = community!.entries.find(
      (e) => e.kind === 'link' && e.id === 'users-analytics',
    )
    const usersOverview = community!.entries.find(
      (e) => e.kind === 'link' && e.id === 'users-overview',
    )
    if (usersAnalytics?.kind === 'link' && usersOverview?.kind === 'link') {
      expect(usersAnalytics.isActive!('/en/admin/users?tab=analytics')).toBe(true)
      expect(usersOverview.isActive!('/en/admin/users?tab=analytics')).toBe(false)
      expect(usersOverview.isActive!('/en/admin/users')).toBe(true)
    }

    const matcherMod = trust!.entries.find(
      (e) => e.kind === 'link' && e.id === 'matcher-moderation',
    )
    const matcherAnalytics = trust!.entries.find(
      (e) => e.kind === 'link' && e.id === 'matcher-analytics',
    )
    if (matcherMod?.kind === 'link' && matcherAnalytics?.kind === 'link') {
      expect(matcherMod.isActive!('/en/admin/matcher?tab=moderation')).toBe(true)
      expect(matcherAnalytics.isActive!('/en/admin/matcher?tab=moderation')).toBe(false)
      expect(matcherAnalytics.isActive!('/en/admin/matcher')).toBe(true)
    }
  })

  it('uses locale tab labels under subsection headings', () => {
    const model = build('admin')
    // Under Users heading, locale short labels are unambiguous (no User* prefix required).
    expect(leafLabelsInGroup(model.groups, 'community')).toEqual(
      expect.arrayContaining(['usersTabOverview', 'usersTabAnalytics', 'Platform Analytics']),
    )
    expect(leafLabelsInGroup(model.groups, 'content')).toEqual(
      expect.arrayContaining(['News Analytics']),
    )
    expect(leafLabelsInGroup(model.groups, 'trust')).toEqual(
      expect.arrayContaining(['Matcher Analytics']),
    )
  })
})
