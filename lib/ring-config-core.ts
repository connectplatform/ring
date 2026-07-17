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
  WebpDerivativeConfig,
  WebpDerivativeProvider,
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
  StorageConfig,
  WebpDerivativeConfig,
  WebpDerivativeProvider,
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
 * Accessor: Returns product fields presets map or null.
 * Supports:
 * - productFieldsPresets.{name} (platform shape)
 * - productFields.presets.{name} (legacy nested)
 */
export const getProductFieldsPresets = cache((): Record<string, { storeCategories?: string[] }> | null => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const top = config.productFieldsPresets as Record<string, { storeCategories?: string[] }> | undefined
  if (top && typeof top === 'object' && Object.keys(top).length > 0) return top
  const nested = (config.productFields as { presets?: Record<string, { storeCategories?: string[] }> } | undefined)
    ?.presets
  if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) return nested
  return null
})

/**
 * Accessor: Returns the active product fields preset name (singular).
 * Supports greenfood `productFields.preset = "agricultural"` and platform presets maps.
 */
export const getProductFieldsPreset = cache((): string => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const singular = (config.productFields as { preset?: string } | undefined)?.preset
  if (typeof singular === 'string' && singular.trim()) return singular.trim()
  const presets = getProductFieldsPresets()
  return presets ? Object.keys(presets)[0] ?? 'platform' : 'platform'
})

/**
 * Accessor: Active entities vertical preset (`entities.preset`).
 * Selects Tier-2 catalog under features/entities/presets/<name>.ts
 * (clone overlays may add custom `<name>.ts` + registry lines — build merge wins).
 * Default: fall back to productFields.preset name, then "platform".
 */
export const getEntitiesPreset = cache((): string => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const singular = (config.entities as { preset?: string } | undefined)?.preset
  if (typeof singular === 'string' && singular.trim()) return singular.trim()
  return getProductFieldsPreset() || 'platform'
})

/**
 * Accessor: Active home landing preset (`home.preset`).
 * Selects Tier-2 landing under components/pages/home-presets/<name>.tsx
 * Default: "platform". MVM e-commerce clones (GreenFood-style): "mvm-landing".
 */
export const getHomePreset = cache((): string => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const singular = (config.home as { preset?: string } | undefined)?.preset
  if (typeof singular === 'string' && singular.trim()) return singular.trim()
  return 'platform'
})

/**
 * Accessor: Active product badges preset (`productBadges.preset`).
 * Default: "platform".
 */
export const getProductBadgesPreset = cache((): string => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const singular = (config.productBadges as { preset?: string } | undefined)?.preset
  if (typeof singular === 'string' && singular.trim()) return singular.trim()
  return getProductFieldsPreset() || 'platform'
})

/**
 * Accessor: productBadgesPresets map (ring-config Tier-1 badge lists per vertical).
 */
export const getProductBadgesPresets = cache((): Record<string, { productBadges?: string[] }> | null => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const top = config.productBadgesPresets as Record<string, { productBadges?: string[] }> | undefined
  if (top && typeof top === 'object' && Object.keys(top).length > 0) return top
  return null
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
    nativeTokenSymbol: config.tokens?.nativeToken?.tokenSymbol
      ?? (config.tokens?.nativeToken as { symbol?: string } | undefined)?.symbol
      ?? 'RING',
    nativeTokenName: config.tokens?.nativeToken?.tokenName
      ?? (config.tokens?.nativeToken as { name?: string } | undefined)?.name
      ?? 'RING Governance Token',
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
 * Empty string is treated as missing (?? alone would not catch '').
 */
export const getDefaultStoreCurrencySymbol = cache((): SupportedCurrencies => {
  const raw = getSystemConfigSnapshot().store?.defaultCurrency
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return (trimmed || 'USD') as SupportedCurrencies
})

/**
 * Returns all supported fiat currency symbols (e.g. ['USD', 'UAH']).
 * SSOT accessor — replaces raw ringConfig.currencies.map(c => c.symbol).
 */
export const getSupportedCurrencies = cache((): SupportedCurrencies[] => {
  const config = getSystemConfigSnapshot()
  const fromList = (config.currencies ?? [])
    .map((c: { symbol?: string }) => c?.symbol)
    .filter((s): s is SupportedCurrencies => Boolean(s && String(s).trim()))
  if (fromList.length > 0) return fromList
  // Fallback when currencies[] is absent — still expose defaultCurrency.
  return [getDefaultStoreCurrencySymbol()]
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
 * Native governance / store-display token symbol (e.g. RING).
 * Accepts both tokenSymbol (typed) and legacy symbol on nativeToken.
 */
export const getNativeTokenSymbol = cache((): string => {
  const native = getSystemConfigSnapshot().tokens?.nativeToken as
    | { tokenSymbol?: string; symbol?: string }
    | undefined
  return native?.tokenSymbol ?? native?.symbol ?? 'RING'
})

/**
 * Returns exchange rates Record<currency, number> relative to DEFAULT_CURRENCY.
 * All rates are relative to DEFAULT_CURRENCY (rate == 1 for the base currency).
 * SSOT accessor — replaces raw ringConfig.exchangeRates.
 * Guarantees defaultCurrency and native token have numeric rates.
 */
export const getExchangeRates = cache((): Record<string, number> => {
  const config = getSystemConfigSnapshot()
  const rates = {
    ...((config as unknown as { exchangeRates?: Record<string, number> }).exchangeRates ?? {}),
  }
  const base = getDefaultStoreCurrencySymbol()
  const native = getNativeTokenSymbol()
  if (typeof rates[base] !== 'number') rates[base] = 1
  if (typeof rates[native] !== 'number') rates[native] = 1
  return rates
})

/**
 * Credit point → store.defaultCurrency multiplier for fiat ledger accounting.
 * SSOT: ring-config.json → credit.unitToDefaultCurrency (typically 1 = 1:1 points:fiat).
 * Fallback: exchangeRates[defaultCurrency], then 1.
 * Do NOT use native-token oracle here — that rate is for desk credit↔native conversion only.
 */
export const getCreditUnitToDefaultCurrencyRate = cache((): number => {
  const config = getSystemConfigSnapshot()
  const explicit = config.credit?.unitToDefaultCurrency
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return explicit
  }
  const rates = getExchangeRates()
  const base = getDefaultStoreCurrencySymbol()
  const fromExchange = rates[base]
  if (typeof fromExchange === 'number' && Number.isFinite(fromExchange) && fromExchange > 0) {
    return fromExchange
  }
  return 1
})

/** String form for CreditBalanceService / WalletConductor usdRate params. */
export function getCreditUnitToDefaultCurrencyRateString(): string {
  return String(getCreditUnitToDefaultCurrencyRate())
}

const DEFAULT_WEBP_MAX_EDGE = 1600
const DEFAULT_WEBP_QUALITY = 82

export type ResolvedWebpDerivativeConfig = {
  provider: WebpDerivativeProvider
  maxEdge: number
  quality: number
}

/**
 * Persistent WebP sibling strategy SSOT.
 * Precedence: IMAGE_WEBP_DISABLED → ring-config.storage.webpDerivative → default provider `off`.
 * Default `off` ensures sharp is never imported unless ops explicitly selects `sharp`.
 */
export const getWebpDerivativeConfig = cache((): ResolvedWebpDerivativeConfig => {
  const disabled =
    process.env.IMAGE_WEBP_DISABLED === '1' ||
    process.env.IMAGE_WEBP_DISABLED === 'true'

  const raw = getSystemConfigSnapshot().storage?.webpDerivative as
    | WebpDerivativeConfig
    | undefined

  const envEdge = Number.parseInt(process.env.IMAGE_WEBP_MAX_EDGE || '', 10)
  const envQuality = Number.parseInt(process.env.IMAGE_WEBP_QUALITY || '', 10)

  const maxEdge =
    (Number.isFinite(envEdge) && envEdge > 0
      ? envEdge
      : typeof raw?.maxEdge === 'number' && raw.maxEdge > 0
        ? raw.maxEdge
        : DEFAULT_WEBP_MAX_EDGE) || DEFAULT_WEBP_MAX_EDGE

  const quality =
    (Number.isFinite(envQuality) && envQuality > 0
      ? envQuality
      : typeof raw?.quality === 'number' && raw.quality > 0
        ? raw.quality
        : DEFAULT_WEBP_QUALITY) || DEFAULT_WEBP_QUALITY

  if (disabled) {
    return { provider: 'off', maxEdge, quality }
  }

  const providerRaw = raw?.provider
  const provider: WebpDerivativeProvider =
    providerRaw === 'sharp' || providerRaw === 'ringbase' || providerRaw === 'off'
      ? providerRaw
      : 'off'

  return { provider, maxEdge, quality }
})
