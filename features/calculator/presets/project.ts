/**
 * Ring Project Calculator preset — founder-facing catalog in credit points.
 * Display FX uses StorePaymentMethodsProvider (left-rail / mobile menu RING↔fiat toggle),
 * same exchangeRates path as /store product listings.
 *
 * Internal catalog unit: credit points (≈ store.mainCurrency when creditBalanceUnitToMainCurrency=1).
 */

export type ProjectModuleDomain = 'core' | 'commerce' | 'community' | 'web3' | 'ai' | 'admin'

/** Pack modules priced at this fraction of a-la-carte when covered by niche pack. */
export const PACK_MODULE_DISCOUNT = 0.7

export const PROJECT_SCALE_IDS = ['small', 'medium', 'large', 'enterprise'] as const
export type ProjectScaleId = (typeof PROJECT_SCALE_IDS)[number]

export const PROJECT_SCALE_MULTIPLIERS: Record<ProjectScaleId, number> = {
  small: 1,
  medium: 1.5,
  large: 2.5,
  enterprise: 4,
}

/** Hosting method — Ringdom K8s is managed hosting, not a “delivery philosophy”. */
export const PROJECT_HOSTING_IDS = ['self_host', 'ringdom'] as const
export type ProjectHostingId = (typeof PROJECT_HOSTING_IDS)[number]

/** One-time construct multipliers by hosting choice. */
export const PROJECT_HOSTING_CONSTRUCT_MULT: Record<ProjectHostingId, number> = {
  self_host: 0.35,
  ringdom: 1,
}

/** Base monthly Ringdom hosting in credit points (before scale). */
export const HOSTING_BASE_POINTS_MONTHLY = 10

export const PROJECT_MODULE_IDS = [
  'auth',
  'entities',
  'opportunities',
  'messaging',
  'store',
  'news',
  'wallet',
  'nft',
  'staking',
  'ai_matcher',
  'analytics',
  'erp',
  'refcodes',
  'email_crm',
  'map',
  'places',
  'meetups',
  'dao',
] as const
export type ProjectModuleId = (typeof PROJECT_MODULE_IDS)[number]

/** A-la-carte module price in credit points. */
export const PROJECT_MODULE_POINTS: Record<ProjectModuleId, number> = {
  auth: 20,
  entities: 40,
  opportunities: 80,
  messaging: 60,
  store: 120,
  news: 90,
  wallet: 100,
  nft: 160,
  staking: 80,
  ai_matcher: 140,
  analytics: 60,
  erp: 150,
  refcodes: 70,
  email_crm: 90,
  map: 110,
  places: 100,
  meetups: 80,
  dao: 90,
}

export const PROJECT_MODULE_DOMAIN: Record<ProjectModuleId, ProjectModuleDomain> = {
  auth: 'core',
  entities: 'community',
  opportunities: 'community',
  messaging: 'community',
  store: 'commerce',
  news: 'community',
  wallet: 'web3',
  nft: 'web3',
  staking: 'web3',
  ai_matcher: 'ai',
  analytics: 'admin',
  erp: 'commerce',
  refcodes: 'commerce',
  email_crm: 'admin',
  map: 'community',
  places: 'community',
  meetups: 'community',
  dao: 'web3',
}

/** Domain accent colors (Feature Map aligned). */
export const PROJECT_DOMAIN_COLORS: Record<
  ProjectModuleDomain,
  { accent: string; soft: string }
> = {
  core: { accent: '#8B5CF6', soft: 'rgba(139, 92, 246, 0.14)' },
  commerce: { accent: '#10B981', soft: 'rgba(16, 185, 129, 0.14)' },
  community: { accent: '#F59E0B', soft: 'rgba(245, 158, 11, 0.14)' },
  web3: { accent: '#3B82F6', soft: 'rgba(59, 130, 246, 0.14)' },
  ai: { accent: '#EC4899', soft: 'rgba(236, 72, 153, 0.14)' },
  admin: { accent: '#64748B', soft: 'rgba(100, 116, 139, 0.14)' },
}

/** Lucide icon names resolved in the UI. */
export const PROJECT_MODULE_ICONS: Record<ProjectModuleId, string> = {
  auth: 'Shield',
  entities: 'Building2',
  opportunities: 'Briefcase',
  messaging: 'MessageSquare',
  store: 'ShoppingBag',
  news: 'Newspaper',
  wallet: 'Wallet',
  nft: 'Image',
  staking: 'Layers',
  ai_matcher: 'Sparkles',
  analytics: 'BarChart3',
  erp: 'Factory',
  refcodes: 'Share2',
  email_crm: 'Mail',
  map: 'Map',
  places: 'MapPin',
  meetups: 'CalendarDays',
  dao: 'Landmark',
}

export const PROJECT_NICHE_IDS = [
  'marketplace',
  'opportunities',
  'cooperative',
  'news_media',
  'multi_vendor',
  'digital_city',
  'scientific',
  'enterprise',
] as const
export type ProjectNicheId = (typeof PROJECT_NICHE_IDS)[number]

export const PROJECT_NICHE_ICONS: Record<ProjectNicheId, string> = {
  marketplace: 'Store',
  opportunities: 'Target',
  cooperative: 'Users',
  news_media: 'Radio',
  multi_vendor: 'ShoppingBasket',
  digital_city: 'Building2',
  scientific: 'FlaskConical',
  enterprise: 'Building',
}

/** Niche pack accent (used for color-coded tiles). */
export const PROJECT_NICHE_COLORS: Record<
  ProjectNicheId,
  { accent: string; soft: string }
> = {
  marketplace: { accent: '#10B981', soft: 'rgba(16, 185, 129, 0.14)' },
  opportunities: { accent: '#D97706', soft: 'rgba(217, 119, 6, 0.14)' },
  cooperative: { accent: '#F59E0B', soft: 'rgba(245, 158, 11, 0.14)' },
  news_media: { accent: '#B45309', soft: 'rgba(180, 83, 9, 0.14)' },
  multi_vendor: { accent: '#059669', soft: 'rgba(5, 150, 105, 0.14)' },
  digital_city: { accent: '#0EA5E9', soft: 'rgba(14, 165, 233, 0.14)' },
  scientific: { accent: '#EC4899', soft: 'rgba(236, 72, 153, 0.14)' },
  enterprise: { accent: '#8B5CF6', soft: 'rgba(139, 92, 246, 0.14)' },
}

export const PROJECT_NICHE_MODULES: Record<ProjectNicheId, readonly ProjectModuleId[]> = {
  marketplace: ['auth', 'entities', 'store', 'messaging', 'places', 'analytics'],
  opportunities: ['auth', 'entities', 'opportunities', 'ai_matcher', 'messaging', 'meetups'],
  /** Niche Social Network */
  cooperative: ['auth', 'entities', 'opportunities', 'messaging', 'meetups', 'map', 'analytics'],
  news_media: ['auth', 'entities', 'news', 'messaging', 'analytics', 'email_crm'],
  multi_vendor: ['auth', 'entities', 'store', 'erp', 'refcodes', 'places', 'analytics'],
  /** Digital City — GIS city layer + civic coordination */
  digital_city: [
    'auth',
    'entities',
    'map',
    'places',
    'meetups',
    'messaging',
    'opportunities',
    'dao',
    'analytics',
  ],
  scientific: ['auth', 'entities', 'messaging', 'ai_matcher', 'analytics'],
  enterprise: ['auth', 'entities', 'opportunities', 'messaging', 'meetups', 'analytics', 'email_crm'],
}

/** Base AI self-construct / clone setup in credit points. */
export const PROJECT_NICHE_BASE_CONSTRUCT_POINTS: Record<ProjectNicheId, number> = {
  marketplace: 120,
  opportunities: 90,
  cooperative: 110,
  news_media: 140,
  multi_vendor: 160,
  digital_city: 170,
  scientific: 150,
  enterprise: 180,
}

export const PROJECT_EXTERNAL_IDS = ['ringbase', 'ringcdn', 'mail', 'dns'] as const
export type ProjectExternalId = (typeof PROJECT_EXTERNAL_IDS)[number]

/**
 * Monthly add-on catalog in store.mainCurrency units.
 * Converted to credit points via creditBalanceUnitToMainCurrency at calculate time.
 */
export const PROJECT_EXTERNAL_MAIN_CURRENCY: Record<ProjectExternalId, number> = {
  ringbase: 15,
  ringcdn: 10,
  mail: 8,
  dns: 5,
}

export const PROJECT_EXTERNAL_ICONS: Record<ProjectExternalId, string> = {
  ringbase: 'HardDrive',
  ringcdn: 'Globe',
  mail: 'Mail',
  dns: 'Network',
}

export const PROJECT_EXTERNAL_COLORS: Record<
  ProjectExternalId,
  { accent: string; soft: string }
> = {
  ringbase: { accent: '#0EA5E9', soft: 'rgba(14, 165, 233, 0.14)' },
  ringcdn: { accent: '#06B6D4', soft: 'rgba(6, 182, 212, 0.14)' },
  mail: { accent: '#6366F1', soft: 'rgba(99, 102, 241, 0.14)' },
  dns: { accent: '#8B5CF6', soft: 'rgba(139, 92, 246, 0.14)' },
}

/** Branding customization in credit points. */
export const BRANDING_CUSTOMIZATION_POINTS = 40
