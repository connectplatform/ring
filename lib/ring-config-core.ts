/**
 * Clone config utilities — safe for both client and server environments.
 * Reads from ring-config.json (concrete, install-time) and template (defaults). 
 * Used as a single source of truth for all whitelabel/platform config values.
 *
 * Server components may prefer getRingConfig() from @/lib/ring-config (cached for perf).
 *
 * Stateless utility exports such as getSystemConfigSnapshot and config accessors now leverage
 * React 19's `cache()` for request-scoped caching to optimize performance.
 */

import { cache } from 'react'  // React19+ for stateless caching
import template from '@/ring-config.template.json'
import concrete from '@/ring-config.json'

import type {
  InstanceConfig,
  PublicInstanceConfig,
  RingConfig,
  SidebarStatConfig,
  SupportedCurrencies,
  SupportedCrypto,
} from '@/lib/ring-config-types'

export type {
  InstanceConfig,
  PublicInstanceConfig,
  RingConfig,
  RingBranding,
  ThemeConfig,
  NavigationConfigSchema,
  LegalConfig,
  DeploymentConfig,
  IntegrationConfig,
  RingHeroConfig,
  SidebarLinkConfig,
  SidebarCommunityLinkConfig,
  SidebarStatConfig,
  SidebarStatValueKey,
} from '@/lib/ring-config-types'

export type {
  NativeChainConfig,
} from '@/lib/ring-config-chain'
const SERVER_FEATURE_KEYS = [
  'entities',
  'opportunities',
  'messaging',
  'admin',
  'news',
] as const;

/**
 * Deep merge utility for RingConfig shape.
 * Takes a base config and overlays any present values from the 'override'
 * Argument, including for partials and nested fields.
 * @param base The template/default config (RingConfig)
 * @param override The concrete install or overlay config (Partial<RingConfig>)
 */
function mergeDeep(base: any, override: any): any {
  if (
    typeof base !== 'object' || base === null ||
    typeof override !== 'object' || override === null
  ) {
    return override !== undefined ? override : base;
  }

  // Both are objects. Merge recursively.
  const result: any = Array.isArray(base) ? [...base] : { ...base };

  // Merge all override keys into result
  for (const key of Object.keys(override)) {
    if (
      override[key] !== undefined &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      // Special case: fix for deployment.resources type mismatch (flatten to strings)
      if (
        key === 'deployment' &&
        typeof override[key] === 'object' &&
        'resources' in override[key] &&
        typeof override[key].resources === 'object' &&
        override[key].resources !== null
      ) {
        const mergedResources: Record<string, string> = {
          ...(base[key]?.resources as Record<string, string> || {}),
          ...(override[key]?.resources as Record<string, string> || {}),
        }
        result[key] = {
          ...mergeDeep(base[key], override[key]),
          resources: Object.fromEntries(
            Object.entries(mergedResources).map(([k, v]) => [k, String(v)])
          ),
        }
      } else {
        result[key] = mergeDeep(base[key], override[key]);
      }
    } else if (override[key] !== undefined) {
      result[key] = override[key];
    }
    // else leave base[key] as is
  }
  return result;
}

// --- Stateless utility exports now use React 19+ native cache() where effective --- //

/**
 * Returns the current merged RingConfig object for this clone,
 * merging concrete (install/instance) values over the template defaults.
 * Request-scoped stateless cache via React 19's cache().
 * @returns The canonical RingConfig for this instance.
 */
export const getSystemConfigSnapshot = cache(function getSystemConfigSnapshot(): RingConfig {
  const merged = mergeDeep(template, concrete);

  // Fix deployment.resources post-merge (see original version for rationale)
  if (
    typeof merged === 'object' &&
    merged !== null &&
    'deployment' in merged &&
    typeof (merged as any).deployment === 'object' &&
    (merged as any).deployment !== null &&
    'resources' in (merged as any).deployment
  ) {
    const dep = (merged as any).deployment;
    if (dep.resources && typeof dep.resources === 'object' && !Array.isArray(dep.resources)) {
      const fixed: Record<string, string> = {};
      Object.entries(dep.resources).forEach(([k, v]) => {
        if (typeof v === 'string') {
          fixed[k] = v;
        } else {
          fixed[k] = JSON.stringify(v);
        }
      });
      dep.resources = fixed;
    }
  }

  return merged as RingConfig;
});

/**
 * Accessor: Returns product fields presets config or null.
 */
export const getProductFieldsPresets = cache((): Record<string, { storeCategories?: string[] }> | null => {
  const config = getSystemConfigSnapshot()
  return (config as unknown as { productFields?: { presets?: Record<string, { storeCategories?: string[] }> } }).productFields?.presets ?? null
})

/**
 * Accessor: Returns the active product fields preset name (singular).
 */
export const getProductFieldsPreset = cache((): string => {
  const presets = getProductFieldsPresets()
  return presets ? Object.keys(presets)[0] ?? 'platform' : 'platform'
})

/**
 * Retrieves current config defaults for public pools, using React 19's cache() for memoization.
 */
export const getPublicPoolConfig = cache((): {
  cloneId: string
  minGoalHours: number
  ringPerMachineHour: number
  likeQueueThreshold: number
} => {
  const { clone, daoPools } = getSystemConfigSnapshot()
  return {
    cloneId: clone?.name ?? '',
    minGoalHours: daoPools?.minGoalHours ?? 1,
    ringPerMachineHour: daoPools?.ringPerMachineHour ?? 1,
    likeQueueThreshold: daoPools?.likeQueueThreshold ?? 100,
  }
})

/**
 * Returns matcher module install-time (file-based) config defaults.
 * DB overlays (admin settings) not included here.
 * @returns Matcher settings with smart defaults for each
 */
export const getMatcherInstallDefaults = cache((): {
  scoreThreshold: number
  maxMatches: number
  autoApprove: boolean
  autoApproveMinScore: number
  llmConfidenceGate: number
} => {
  const m = getSystemConfigSnapshot().matcher ?? {}
  return {
    scoreThreshold: m.scoreThreshold ?? 0.7,
    maxMatches: m.maxMatches ?? 10,
    autoApprove: m.autoApprove ?? false,
    autoApproveMinScore: m.autoApproveMinScore ?? 0.7,
    llmConfidenceGate: m.llmConfidenceGate ?? 0.8,
  }
})

/**
 * Determines if the roadmap module should be enabled for the current instance.
 * By default, enabled unless explicitly set false in config.
 * Now cached with React 19+ cache().
 */
export const isRoadmapModuleEnabled = cache(
  (config: RingConfig = getSystemConfigSnapshot()): boolean => {
    return config.features?.roadmap?.enabled !== false
  }
);

/**
 * Converts features config into strict boolean flags for server-side logic.
 * - Flattens 'enabled' keys from legacy/complex objects.
 * - Only returns SERVER_FEATURE_KEYS and expertServicesMarketplace flag.
 * @param features Features config (from RingConfig)
 * Now cached for typical usage across stateless runtime boundary.
 */
export const resolveFeatureFlags = cache(
  (features: RingConfig['features'] = {}): Record<string, boolean> => {
    const result: Record<string, boolean> = {}
    for (const key of SERVER_FEATURE_KEYS) {
      const val = features[key]
      if (typeof val === 'boolean') {
        result[key] = val
      } else if (val && typeof val === 'object' && 'enabled' in val) {
        result[key] = Boolean((val as { enabled?: boolean }).enabled)
      } else {
        result[key] = true
      }
    }
    if (typeof features.expertServicesMarketplace === 'boolean') {
      result.expertServicesMarketplace = features.expertServicesMarketplace
    }
    return result
  }
);

/**
 * Computes a string value for a sidebar stat cell.
 * Recognizes special valueKeys for version, license.
 * @param stat SidebarStatConfig item
 * @param config Active RingConfig object
 * @returns String to render in the UI
 */
function resolveSidebarStatValue(stat: SidebarStatConfig, config: RingConfig): string {
  if (stat.valueKey === 'clone.version') {
    return config.clone?.version ?? '1.0.0'
  }
  if (stat.valueKey === 'legal.licenseSpdx') {
    return config.legal?.licenseSpdx ?? 'MIT'
  }
  return stat.value ?? '—'
}

/**
 * Returns sidebar stats mapped to concrete display values (labelKey & value).
 * Cached via React 19 cache() for stateless perf.
 */
export const getResolvedSidebarStats = cache((): Array<{ labelKey: string; value: string }> => {
  const config = getSystemConfigSnapshot()
  return (config.branding?.sidebar?.stats ?? []).map((stat) => ({
    labelKey: stat.labelKey,
    value: resolveSidebarStatValue(stat, config),
  }))
})

/**
 * Helper: Given a 'social.<platform>' key, returns its config value or "#" if unset.
 * Uses config snapshot, now cached for perf.
 */
export const resolveSocialUrlFromConfig = cache((
  urlKey: string,
  config = getSystemConfigSnapshot()
): string => {
  const key = urlKey.replace(/^social\./, '') as keyof NonNullable<RingConfig['social']>
  return config.social?.[key] ?? '#'
})

/**
 * Converts a full RingConfig to an InstanceConfig (runtime shape for components).
 * Applies default/fallback values for all essential fields (colors, SEO, etc.).
 * @param config Any valid, complete RingConfig object
 * @returns InstanceConfig object ready for use
 * Cached across the request for perf.
 */
export const ringConfigToInstanceConfig = cache((config: RingConfig): InstanceConfig => {
  const colors = config.branding?.colors
  const siteName = config.seo?.siteName ?? config.clone?.displayName ?? 'Ring Platform'
  return {
    name: siteName,
    brand: {
      colors: {
        primary: colors?.primary ?? '#3b82f6',
        background: colors?.background ?? '#0b0f1a',
        foreground: colors?.foreground ?? '#e5e7eb',
        accent: colors?.accent ?? '#22c55e',
      },
      logoUrl: config.branding?.logo?.light ?? '/images/logo.svg',
      faviconUrl: config.branding?.logo?.favicon ?? '/favicon.ico',
      ogImageUrl: config.seo?.ogImage ?? config.branding?.logo?.light ?? '/og-ring-platform-1200x630.jpg',
    },
    theme: config.theme ?? { default: 'system' },
    seo: {
      titleSuffix: config.seo?.titleSuffix ?? ` · ${siteName}`,
      defaultDescription:
        config.seo?.siteDescription ??
        config.clone?.description ??
        'Open white-label professional network.',
    },
    navigation: config.navigation,
    hero: config.hero,
    features: resolveFeatureFlags(config.features),
  }
})

/**
 * Public config serializer — strips out any private/admin-only values.
 * Only includes client-safe fields for hydration or static use.
 * Now uses request cache as well.
 */
export const toPublicInstanceConfig = cache((cfg: InstanceConfig): PublicInstanceConfig => {
  return {
    name: cfg.name,
    brand: {
      colors: {
        primary: cfg.brand.colors.primary,
        background: cfg.brand.colors.background,
        foreground: cfg.brand.colors.foreground,
        accent: cfg.brand.colors.accent,
      },
      logoUrl: cfg.brand.logoUrl,
      faviconUrl: cfg.brand.faviconUrl,
      ogImageUrl: cfg.brand.ogImageUrl,
    },
    theme: cfg.theme,
    seo: cfg.seo,
    navigation: cfg.navigation,
    hero: cfg.hero,
    features: cfg.features,
  }
})

/**
 * Returns a snapshot-based public config object,
 * suitable for SSG (static) exports and client fallback.
 */
export const getPublicInstanceConfigFromSnapshot = cache((): PublicInstanceConfig => {
  return toPublicInstanceConfig(ringConfigToInstanceConfig(getSystemConfigSnapshot()))
})

// --- Instance config caching and DB overlay management ---

let cachedInstance: InstanceConfig | null = null
let cachedFromDb: InstanceConfig | null = null
let dbLoadAttempted = false

function applyDbBrandingOverlay(
  base: InstanceConfig,
  branding: {
    name: string
    brand: InstanceConfig['brand']
    theme?: InstanceConfig['theme']
    features: Record<string, boolean>
  },
): InstanceConfig {
  return {
    ...base,
    name: branding.name || base.name,
    brand: {
      ...base.brand,
      ...branding.brand,
      colors: { ...base.brand.colors, ...branding.brand.colors },
    },
    theme: branding.theme ?? base.theme,
    features: { ...base.features, ...branding.features },
  }
}

async function loadInstanceConfigFromDb(): Promise<InstanceConfig | null> {
  if (typeof window !== 'undefined') return null
  if (process.env.PLATFORM_SETTINGS_DISABLE_DB === 'true') return null
  try {
    const { getPlatformBrandingData } = await import(
      '@/features/admin/platform-settings/platform-settings-service'
    )
    const branding = await getPlatformBrandingData()
    const snapshot = ringConfigToInstanceConfig(getSystemConfigSnapshot())
    return applyDbBrandingOverlay(snapshot, branding)
  } catch {
    return null
  }
}

/**
 * Async entry point: Returns up-to-date instance config, overlays DB settings if available.
 * Caches config after first load. Only invalidated via explicit call.
 */
export async function getInstanceConfigAsync(): Promise<InstanceConfig> {
  if (cachedFromDb) return cachedFromDb
  if (!dbLoadAttempted) {
    dbLoadAttempted = true
    cachedFromDb = await loadInstanceConfigFromDb()
  }
  if (cachedFromDb) return cachedFromDb
  return getInstanceConfig()
}

/**
 * Synchronous getter for instance config, including (if available) DB overlays.
 * Uses cached values for performance unless cache is manually invalidated.
 */
export function getInstanceConfig(): InstanceConfig {
  if (cachedFromDb) return cachedFromDb
  if (cachedInstance) return cachedInstance
  cachedInstance = ringConfigToInstanceConfig(getSystemConfigSnapshot())
  return cachedInstance
}

/**
 * Complete cache reset for both file and DB-config paths.
 * Call after admin branding or settings changes.
 */
export function invalidateInstanceConfigCache(): void {
  cachedInstance = null
  cachedFromDb = null
  dbLoadAttempted = false
  // When Next/React's invalidation APIs stabilize, migrate to those.
}

/**
 * Returns the active primary brand colors object from current instance config.
 */
export const getBrandColors = cache(() => {
  return getInstanceConfig().brand.colors
})

/**
 * Predicate to check if a named feature is enabled, using current config.
 * Defaults to true if feature state is missing.
 */
export const isFeatureEnabled = cache((key: string, defaultValue = true): boolean => {
  const { features } = getInstanceConfig()
  return features[key] ?? defaultValue
})

/**
 * Retrieves the safe, public instance config for client exposure or SEO export.
 */
export const getPublicInstanceConfig = cache((): PublicInstanceConfig => {
  return toPublicInstanceConfig(getInstanceConfig())
})

/**
 * Resolves the canonical base URL for this Ring clone/platform; 
 * checks env vars in priority order, then falls back to config defaults.
 */
export const getSiteBaseUrl = cache((): string => {
  const config = getSystemConfigSnapshot()
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    config.domains?.production ||
    config.platform?.baseUrl ||
    'https://ring-platform.org'
  ).replace(/\/$/, '')
})

/**
 * Provides SEO branding info: siteName, Twitter, OG image.
 * Used for meta tags, social/embedding, sharing, SEO enhancements.
 */
export const getRingSeoBranding = cache((): {
  siteName: string
  twitterSite: string
  ogImage: string
} => {
  const config = getSystemConfigSnapshot()
  return {
    siteName: config.seo?.siteName ?? config.clone?.displayName ?? 'Ring Platform',
    twitterSite: config.seo?.twitterHandle ?? '@ringdomx',
    ogImage: config.seo?.ogImage ?? '/og-ring-platform-1280x720.jpg',
  }
})

/**
 * Returns all configured public social media URLs for this clone/platform.
 */
export const getSocialLinks = cache((): {
  github: string
  twitter: string
  linkedin: string
  discord: string
  telegram: string
} => {
  const social = getSystemConfigSnapshot().social ?? {}
  return {
    github: social.github ?? '',
    twitter: social.twitter ?? '',
    linkedin: social.linkedin ?? '',
    discord: social.discord ?? '',
    telegram: social.telegram ?? '',
  }
})

/**
 * Outputs platform identity info for display/onboarding/etc.
 */
export const getPlatformIdentity = cache((): {
  name: string
  shortName: string
  domain: string
  demoUserEmail: string
  nativeTokenSymbol?: string
  nativeTokenName?: string
} => {
  const config = getSystemConfigSnapshot()
  const production = config.domains?.production ?? config.platform?.baseUrl ?? ''
  let domain = production
  try {
    if (production.startsWith('http')) {
      domain = new URL(production).hostname
    } else {
      domain = production.replace(/\/$/, '')
    }
  } catch {
    domain = production.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
  return {
    name: config.clone?.displayName ?? 'Ring Platform',
    shortName: config.clone?.shortName ?? 'Ring',
    domain,
    demoUserEmail:
      config.integrations?.demoUserEmail ??
      config.clone?.contactEmail ??
      config.contact?.email ??
      '',
    nativeTokenSymbol: config.tokens?.nativeToken?.tokenSymbol ?? 'RING',
    nativeTokenName: config.tokens?.nativeToken?.tokenName ?? 'RING Governance Token',
  }
})


/** 
 * Returns the default UI theme for the clone from config/template.
 */
export const getDefaultTheme = cache((): 'light' | 'dark' | 'system' => {
  return getSystemConfigSnapshot().theme?.default ?? 'system'
})

/**
 * Returns the configured store currency unit for the instance.
 */
export const getDefaultStoreCurrencySymbol = cache((): SupportedCurrencies => {
  return getSystemConfigSnapshot().store?.defaultCurrency ?? 'USD'
})

/**
 * Returns all supported fiat currency symbols (e.g. ['USD', 'UAH']).
 * SSOT accessor — replaces raw ringConfig.currencies.map(c => c.symbol).
 */
export const getSupportedCurrencies = cache((): SupportedCurrencies[] => {
  const config = getSystemConfigSnapshot()
  return (config.currencies ?? []).map((c: { symbol: SupportedCurrencies }) => c.symbol)
})

/**
 * Returns all supported crypto/token symbols (e.g. ['RING', 'SOL', 'POL']).
 * SSOT accessor — replaces raw ringConfig.tokens.supported.
 */
export const getSupportedCrypto = cache((): SupportedCrypto[] => {
  const config = getSystemConfigSnapshot()
  return config.tokens?.supported ?? []
})

/**
 * Returns exchange rates Record<currency, number> relative to DEFAULT_CURRENCY.
 * All rates are relative to DEFAULT_CURRENCY (rate == 1 for the base currency).
 * SSOT accessor — replaces raw ringConfig.exchangeRates.
 */
export const getExchangeRates = cache((): Record<string, number> => {
  const config = getSystemConfigSnapshot()
  return (config as unknown as { exchangeRates?: Record<string, number> }).exchangeRates ?? {}
})
