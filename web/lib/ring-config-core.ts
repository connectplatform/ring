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
  CollectiveOrderConfigRail,
  InstanceConfig,
  PublicInstanceConfig,
  RingConfig,
  SidebarStatConfig,
  SupportedCurrencies,
  SupportedCrypto,
  WebpDerivativeConfig,
  WebpDerivativeProvider,
} from '@/lib/ring-config-types'
import { getFxOverlayRates } from '@/lib/fx/fx-rates-overlay'

export type {
  InstanceConfig,
  PublicInstanceConfig,
  RingConfig,
  RingBranding,
  ThemeConfig,
  NavigationConfigSchema,
  PlatformMenuConfig,
  PlatformMenuExtraItem,
  LegalConfig,
  DeploymentConfig,
  IntegrationConfig,
  RingHeroConfig,
  SidebarLinkConfig,
  SidebarCommunityLinkConfig,
  SidebarStatConfig,
  SidebarStatValueKey,
  StorageConfig,
  SupportedCurrencies,
  SupportedCrypto,
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
 * Read a feature/module flag from a config object.
 * Accepts boolean leaves (`features.entities: false`) and `{ enabled }` objects.
 * If the path ends in `.enabled` and the parent is already a boolean, that boolean wins.
 */
export function readFeatureFlagPath(root: unknown, path: string): boolean | undefined {
  const parts = path.split('.').filter(Boolean)
  let cur: unknown = root
  for (let i = 0; i < parts.length; i++) {
    if (typeof cur === 'boolean') {
      const rest = parts.slice(i).join('.')
      return rest === 'enabled' ? cur : undefined
    }
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[parts[i]]
  }
  if (typeof cur === 'boolean') return cur
  if (cur && typeof cur === 'object' && 'enabled' in cur) {
    const enabled = (cur as { enabled?: unknown }).enabled
    if (typeof enabled === 'boolean') return enabled
  }
  return undefined
}

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

  // Order Lab / My Orders overlay from ConfigMap (shared-image runtime SSOT).
  // Env must already be a RingConfig deep-partial (transform at write time in empire
  // projectConfigToConfigMapEnv → projectConfigToRingOverlay). Layer1 only mergeDeep.
  const overlayRaw = process.env.RING_ORDER_PROJECT_CONFIG
  let withOverlay = merged
  if (overlayRaw && typeof overlayRaw === 'string' && overlayRaw.trim()) {
    try {
      const parsed = JSON.parse(overlayRaw) as Partial<RingConfig>
      withOverlay = mergeDeep(merged, parsed)
    } catch {
      // Invalid overlay must not break boot — keep file snapshot
      withOverlay = merged
    }
  }

  // Fix deployment.resources post-merge (see original version for rationale)
  if (
    typeof withOverlay === 'object' &&
    withOverlay !== null &&
    'deployment' in withOverlay &&
    typeof (withOverlay as any).deployment === 'object' &&
    (withOverlay as any).deployment !== null &&
    'resources' in (withOverlay as any).deployment
  ) {
    const dep = (withOverlay as any).deployment;
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

  return withOverlay as RingConfig;
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
 * Default: "platform". Vertical landings are pack/clone files under home-presets/<preset>.tsx.
 */
export const getHomePreset = cache((): string => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const singular = (config.home as { preset?: string } | undefined)?.preset
  if (typeof singular === 'string' && singular.trim()) return singular.trim()
  return 'platform'
})

/** Alias — same as getHomePreset (landing customization SSOT). */
export const getHomeLandingPreset = getHomePreset

/**
 * L2 pack id (`presets.pack`) — folder name under ring-presets/<pack>/.
 * Empty on two-layer clones. Compose scripts / clone-build read this when presets_project is omitted.
 */
export const getPresetPack = cache((): string | null => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const presets = config.presets as { pack?: unknown } | undefined
  if (presets && typeof presets.pack === 'string' && presets.pack.trim()) {
    return presets.pack.trim()
  }
  return null
})

/**
 * Tier-3 domain overlay id = ring-config `overlay.featureId`.
 * Clones set that key (e.g. n9life) and keep their domain blob + overlay registry maps.
 * Platform ring-config has none → null (empty overlay registries).
 */
export const getOverlayFeature = cache((): string | null => {
  const config = getSystemConfigSnapshot() as unknown as Record<string, unknown>
  const overlay = config.overlay as { featureId?: unknown } | undefined
  if (overlay && typeof overlay.featureId === 'string' && overlay.featureId.trim()) {
    return overlay.featureId.trim()
  }
  return null
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
  autoPayoutOnGoalMet: boolean
  platformFeePercentByRole: Record<string, number>
} => {
  const snap = getSystemConfigSnapshot() as unknown as {
    clone?: { name?: string }
    daoPools?: {
      minGoalHours?: number
      ringPerMachineHour?: number
      likeQueueThreshold?: number
      autoPayoutOnGoalMet?: boolean
      platformFeePercentByRole?: Record<string, number>
    } | string[]
    publicPools?: {
      minGoalHours?: number
      ringPerMachineHour?: number
      likeQueueThreshold?: number
      autoPayoutOnGoalMet?: boolean
      platformFeePercentByRole?: Record<string, number>
    }
  }
  const dao =
    snap.daoPools && typeof snap.daoPools === 'object' && !Array.isArray(snap.daoPools)
      ? snap.daoPools
      : undefined
  const pub = snap.publicPools
  return {
    cloneId: snap.clone?.name ?? '',
    minGoalHours: pub?.minGoalHours ?? dao?.minGoalHours ?? 1,
    ringPerMachineHour: pub?.ringPerMachineHour ?? dao?.ringPerMachineHour ?? 1,
    likeQueueThreshold: pub?.likeQueueThreshold ?? dao?.likeQueueThreshold ?? 100,
    autoPayoutOnGoalMet: pub?.autoPayoutOnGoalMet ?? dao?.autoPayoutOnGoalMet ?? true,
    platformFeePercentByRole: {
      ...(dao?.platformFeePercentByRole ?? {}),
      ...(pub?.platformFeePercentByRole ?? {}),
    },
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
      result[key] = readFeatureFlagPath(features, key) ?? true
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
 * Project **main currency** symbol — settlement / desk FX / treasury-swap notional unit.
 * SSOT: ring-config.json → `store.mainCurrency`.
 * Empty string is treated as missing (?? alone would not catch '').
 */
export const getMainCurrencySymbol = cache((): SupportedCurrencies => {
  const raw = getSystemConfigSnapshot().store?.mainCurrency
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return (trimmed || 'USD') as SupportedCurrencies
})

/**
 * Payment rails a collective order offers by default.
 * SSOT: ring-config.json → `opportunities.collectiveOrder.defaultRails`.
 */
export const getCollectiveOrderDefaultRails = cache((): CollectiveOrderConfigRail[] => {
  const configured = getSystemConfigSnapshot().opportunities?.collectiveOrder?.defaultRails
  return Array.isArray(configured) && configured.length > 0
    ? configured
    : ['credit_balance', 'card', 'paypal']
})

/**
 * Returns all supported fiat currency symbols (e.g. ['USD', 'UAH']).
 * SSOT accessor — replaces raw ringConfig.currencies.map(c => c.symbol).
 */
/**
 * Fiat codes accepted for store presentment / display.
 * Prefer `supportedCurrencies` (checkout allow-list); fall back to `currencies[].symbol`.
 */
export const getSupportedCurrencies = cache((): SupportedCurrencies[] => {
  const config = getSystemConfigSnapshot()
  const presentment = (config.supportedCurrencies ?? [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s): s is SupportedCurrencies => Boolean(s))
  if (presentment.length > 0) return presentment

  const fromList = (config.currencies ?? [])
    .map((c: { symbol?: string }) => c?.symbol)
    .filter((s): s is SupportedCurrencies => Boolean(s && String(s).trim()))
  if (fromList.length > 0) return fromList
  // Fallback when currencies[] is absent — still expose main currency.
  return [getMainCurrencySymbol()]
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
 * Thin snapshot read — prefer `@/lib/ring-config-chain` getNativeTokenSymbol for
 * full chain-aware resolution (cannot re-export from chain here: chain imports core).
 */
export const getNativeTokenSymbol = cache((): string => {
  const native = getSystemConfigSnapshot().tokens?.nativeToken as
    | { tokenSymbol?: string; symbol?: string }
    | undefined
  return native?.tokenSymbol ?? native?.symbol ?? 'RING'
})

/**
 * Returns exchange rates Record<symbol, number> relative to the **main currency**.
 * Base currency has rate == 1 (`store.mainCurrency`).
 * Resolution: static exchangeRates → live FX feed overlay → fx.manualOverrides.
 */
export const getExchangeRates = cache((): Record<string, number> => {
  const config = getSystemConfigSnapshot()
  const rates: Record<string, number> = {
    ...((config as unknown as { exchangeRates?: Record<string, number> }).exchangeRates ?? {}),
  }

  // Live feed overlay (server warm cache from NBU); empty on client until hydrated.
  const overlay = getFxOverlayRates()
  if (overlay) Object.assign(rates, overlay)

  const manual = config.fx?.manualOverrides
  if (manual && typeof manual === 'object') {
    for (const [code, value] of Object.entries(manual)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        rates[code.toUpperCase()] = value
      }
    }
  }

  const base = getMainCurrencySymbol()
  const native = getNativeTokenSymbol()
  if (typeof rates[base] !== 'number') rates[base] = 1
  if (typeof rates[native] !== 'number') rates[native] = 1
  return rates
})

/**
 * Credit balance unit → main currency multiplier for ledger accounting.
 * SSOT: ring-config.json → credit.creditBalanceUnitToMainCurrency (typically 0.1 = 10 points ≡ 1 main).
 * Fallback: exchangeRates[mainCurrency], then 1.
 * Do NOT use native-token oracle here — that rate is for desk credit↔native conversion only.
 */
export const getCreditUnitToMainCurrencyRate = cache((): number => {
  const config = getSystemConfigSnapshot()
  const explicit = config.credit?.creditBalanceUnitToMainCurrency
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return explicit
  }
  const rates = getExchangeRates()
  const base = getMainCurrencySymbol()
  const fromExchange = rates[base]
  if (typeof fromExchange === 'number' && Number.isFinite(fromExchange) && fromExchange > 0) {
    return fromExchange
  }
  return 1
})

/**
 * USD per 1 main-currency unit — bridge for Chainlink TOKEN/USD → main.
 *
 * Precedence:
 * 1. main === 'USD' → 1
 * 2. store.mainCurrencyToUsd (manual admin override — preferred)
 * 3. exchangeRates bridge:
 *    - If rates are relative to main (rates[main]===1): use rates.USD (USD per 1 main)
 *    - If rates are relative to USD (rates.USD===1): use 1/rates[main]
 * 4. else throw (do not guess)
 *
 * Cron/third-party FX should write store.mainCurrencyToUsd or consistent exchangeRates (24h).
 */
export const getMainCurrencyToUsdRate = cache((): number => {
  const main = getMainCurrencySymbol()
  if (main === 'USD') return 1

  const config = getSystemConfigSnapshot()
  const explicit = config.store?.mainCurrencyToUsd
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return explicit
  }

  const rates = getExchangeRates()
  const mainRate = rates[main]
  const usdRate = rates.USD

  // Main is the FX base: rates.USD = USD per 1 main (must not be ambiguous 1/1).
  if (
    typeof mainRate === 'number' &&
    mainRate === 1 &&
    typeof usdRate === 'number' &&
    Number.isFinite(usdRate) &&
    usdRate > 0 &&
    usdRate !== 1
  ) {
    return usdRate
  }

  // USD is the FX base (store catalog convention): rates[main] = main units per 1 USD.
  if (
    typeof usdRate === 'number' &&
    usdRate === 1 &&
    typeof mainRate === 'number' &&
    Number.isFinite(mainRate) &&
    mainRate > 0
  ) {
    return 1 / mainRate
  }

  throw new Error(
    `main_currency_to_usd_not_configured:${main} — set store.mainCurrencyToUsd (USD per 1 ${main})`,
  )
})

/**
 * Convert an amount quoted in any configured currency into the main currency.
 *
 * `exchangeRates` is a Record<symbol, units-per-1-base>. When main is the FX base
 * (`rates[main] === 1`), `rates[code]` is *code units per 1 main*, so we divide.
 * When another symbol is the base, we bridge through it. Unknown codes fall back
 * to the identity conversion — never silently zero an order out.
 */
export function convertToMainCurrency(amount: number, currencyCode?: string): number {
  if (!Number.isFinite(amount)) return 0
  const main = getMainCurrencySymbol()
  const code = (currencyCode || main).trim().toUpperCase()
  if (!code || code === main) return amount

  const rates = getExchangeRates()
  const fromRate = rates[code]
  const mainRate = rates[main]
  if (
    typeof fromRate !== 'number' ||
    !Number.isFinite(fromRate) ||
    fromRate <= 0 ||
    typeof mainRate !== 'number' ||
    !Number.isFinite(mainRate) ||
    mainRate <= 0
  ) {
    return amount
  }

  return (amount * mainRate) / fromRate
}

/**
 * Convert a main-currency amount into a gateway/settlement currency.
 *
 * Inverse of {@link convertToMainCurrency}. Needed when a processor settles in a
 * fixed currency (PayPal `payment.gateways.paypal.currency`) while the catalogue
 * is quoted in `store.mainCurrency`. Bridges via `store.mainCurrencyToUsd` when
 * the target is USD and `exchangeRates` has no direct pair.
 */
export function convertFromMainCurrency(amount: number, currencyCode?: string): number {
  if (!Number.isFinite(amount)) return 0
  const main = getMainCurrencySymbol()
  const code = (currencyCode || main).trim().toUpperCase()
  if (!code || code === main) return amount

  const rates = getExchangeRates()
  const toRate = rates[code]
  const mainRate = rates[main]
  if (
    typeof toRate === 'number' &&
    Number.isFinite(toRate) &&
    toRate > 0 &&
    typeof mainRate === 'number' &&
    Number.isFinite(mainRate) &&
    mainRate > 0
  ) {
    return (amount * toRate) / mainRate
  }

  if (code === 'USD') {
    try {
      return amount * getMainCurrencyToUsdRate()
    } catch {
      return amount
    }
  }

  return amount
}

/** String form for CreditBalanceService / WalletConductor main-currency rate params. */
export function getCreditUnitToMainCurrencyRateString(): string {
  return String(getCreditUnitToMainCurrencyRate())
}

/**
 * Credit balance unit label (ring-config `credit.creditBalanceUnitLabel`).
 * SSOT default: `points`. This is the denomination of `users.credit_balance`.
 */
export const getCreditUnitLabel = cache((): string => {
  const label = getSystemConfigSnapshot().credit?.creditBalanceUnitLabel
  return typeof label === 'string' && label.trim() ? label.trim() : 'points'
})

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
