export const DEPLOYMENT_USE_CASE_IDS = [
  'marketplace',
  'opportunities',
  'cooperative',
  'community',
  'enterprise',
] as const

export const DEPLOYMENT_MODULE_IDS = [
  'auth',
  'entities',
  'opportunities',
  'messaging',
  'store',
  'wallet',
  'nft',
  'staking',
  'analytics',
  'api',
] as const

export const DEPLOYMENT_MODULE_HOURS: Record<(typeof DEPLOYMENT_MODULE_IDS)[number], number> = {
  auth: 2,
  entities: 4,
  opportunities: 8,
  messaging: 6,
  store: 12,
  wallet: 10,
  nft: 16,
  staking: 8,
  analytics: 6,
  api: 4,
}

export const DEPLOYMENT_DATABASE_IDS = ['firebase', 'postgresql', 'connect'] as const

export const DEPLOYMENT_DATABASE_META: Record<
  (typeof DEPLOYMENT_DATABASE_IDS)[number],
  { setupHours: number; cost: number }
> = {
  firebase: { setupHours: 1, cost: 0 },
  postgresql: { setupHours: 4, cost: 50 },
  connect: { setupHours: 2, cost: 200 },
}

export const DEPLOYMENT_REGION_IDS = ['global', 'europe', 'asia', 'americas'] as const

export const DEPLOYMENT_REGION_COSTS: Record<(typeof DEPLOYMENT_REGION_IDS)[number], number> = {
  global: 50,
  europe: 45,
  asia: 35,
  americas: 40,
}
