export type FeatureKey =
  | 'entities'
  | 'opportunities'
  | 'messaging'
  | 'admin'

export const FEATURE_KEYS: FeatureKey[] = [
  'entities',
  'opportunities',
  'messaging',
  'admin',
]

export function isFeatureEnabledOnServer(key: FeatureKey) {
  const { getInstanceConfig } = require('@/lib/instance-config')
  const cfg = getInstanceConfig()
  return cfg.features[key] ?? true
}

export function featureGuard<T>(key: FeatureKey, enabled: () => Promise<T> | T, disabled: () => Promise<T> | T) {
  if (isFeatureEnabledOnServer(key)) return enabled()
  return disabled()
}
