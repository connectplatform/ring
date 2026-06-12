/**
 * Clone config — safe for client and server (reads ring-config.json + template).
 * Single source of truth for install-time whitelabel + platform identity.
 * Server components may prefer getRingConfig() from @/lib/ring-config (cached).
 */
import template from '@/ring-config.template.json'
import concrete from '@/ring-config.json'
import type {
  InstanceConfig,
  PublicInstanceConfig,
  RingConfig,
  SidebarStatConfig,
} from '@/lib/ring-config-types'

export type {
  InstanceConfig,
  PublicInstanceConfig,
  RingConfig,
  RingBranding,
  RingThemeConfig,
  RingNavigationConfig,
  RingHeroConfig,
  SidebarLinkConfig,
  SidebarCommunityLinkConfig,
  SidebarStatConfig,
  SidebarStatValueKey,
} from '@/lib/ring-config-types'

const SERVER_FEATURE_KEYS = ['entities', 'opportunities', 'messaging', 'admin', 'news'] as const

function mergeDeep(base: RingConfig, override: Partial<RingConfig>): RingConfig {
  return {
    ...base,
    ...override,
    branding: {
      ...base.branding,
      ...override.branding,
      logo: { ...base.branding?.logo, ...override.branding?.logo },
      colors: { ...base.branding?.colors, ...override.branding?.colors },
      darkColors: { ...base.branding?.darkColors, ...override.branding?.darkColors },
      fonts: { ...base.branding?.fonts, ...override.branding?.fonts },
    },
    features: { ...base.features, ...override.features },
    theme: { ...base.theme, ...override.theme },
    navigation: override.navigation ?? base.navigation,
    hero: override.hero ?? base.hero,
    sidebar: override.sidebar ?? base.sidebar,
    calculator: override.calculator ?? base.calculator,
    productFields: override.productFields ?? base.productFields,
    productBadges: override.productBadges ?? base.productBadges,
    contact: override.contact ?? base.contact,
    platform: { ...base.platform, ...override.platform },
    tokens: {
      ...base.tokens,
      ring: { ...base.tokens?.ring, ...override.tokens?.ring },
    },
    social: { ...base.social, ...override.social },
    seo: { ...base.seo, ...override.seo },
    legal: { ...base.legal, ...override.legal },
    domains: { ...base.domains, ...override.domains },
    clone: { ...base.clone, ...override.clone },
    matcher: { ...base.matcher, ...override.matcher },
  }
}

/** Install-time matcher defaults from ring-config (not DB overlay). */
export function getMatcherInstallDefaults(): {
  scoreThreshold: number
  maxMatches: number
  autoApprove: boolean
  autoApproveMinScore: number
  llmConfidenceGate: number
} {
  const m = getRingConfigSnapshot().matcher ?? {}
  return {
    scoreThreshold: m.scoreThreshold ?? 0.7,
    maxMatches: m.maxMatches ?? 10,
    autoApprove: m.autoApprove ?? false,
    autoApproveMinScore: m.autoApproveMinScore ?? 0.7,
    llmConfidenceGate: m.llmConfidenceGate ?? 0.8,
  }
}

export function getRingConfigSnapshot(): RingConfig {
  return mergeDeep(template as RingConfig, concrete as Partial<RingConfig>)
}

export function resolveFeatureFlags(
  features: RingConfig['features'] = {},
): Record<string, boolean> {
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

function resolveSidebarStatValue(stat: SidebarStatConfig, config: RingConfig): string {
  if (stat.valueKey === 'clone.version') {
    return config.clone?.version ?? '1.0.0'
  }
  if (stat.valueKey === 'legal.licenseSpdx') {
    return config.legal?.licenseSpdx ?? 'MIT'
  }
  return stat.value ?? '—'
}

export function getResolvedSidebarStats(): Array<{ labelKey: string; value: string }> {
  const config = getRingConfigSnapshot()
  return (config.sidebar?.stats ?? []).map((stat) => ({
    labelKey: stat.labelKey,
    value: resolveSidebarStatValue(stat, config),
  }))
}

export function resolveSocialUrlFromConfig(urlKey: string, config = getRingConfigSnapshot()): string {
  const key = urlKey.replace(/^social\./, '') as keyof NonNullable<RingConfig['social']>
  return config.social?.[key] ?? '#'
}

export function ringConfigToInstanceConfig(config: RingConfig): InstanceConfig {
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
      ogImageUrl: config.seo?.ogImage ?? config.branding?.logo?.light ?? '/images/og-image.png',
    },
    theme: config.theme ?? { default: 'system' },
    seo: {
      titleSuffix: config.seo?.titleSuffix ?? ` · ${siteName}`,
      defaultDescription:
        config.seo?.siteDescription ?? config.clone?.description ?? 'Open white-label professional network.',
    },
    navigation: config.navigation,
    hero: config.hero,
    features: resolveFeatureFlags(config.features),
  }
}

export function toPublicInstanceConfig(cfg: InstanceConfig): PublicInstanceConfig {
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
}

/** File/snapshot-only public config — safe for client static fallbacks. */
export function getPublicInstanceConfigFromSnapshot(): PublicInstanceConfig {
  return toPublicInstanceConfig(ringConfigToInstanceConfig(getRingConfigSnapshot()))
}

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
    const snapshot = ringConfigToInstanceConfig(getRingConfigSnapshot())
    return applyDbBrandingOverlay(snapshot, branding)
  } catch {
    return null
  }
}

export async function getInstanceConfigAsync(): Promise<InstanceConfig> {
  if (cachedFromDb) return cachedFromDb
  if (!dbLoadAttempted) {
    dbLoadAttempted = true
    cachedFromDb = await loadInstanceConfigFromDb()
  }
  if (cachedFromDb) return cachedFromDb
  return getInstanceConfig()
}

export function getInstanceConfig(): InstanceConfig {
  if (cachedFromDb) return cachedFromDb
  if (cachedInstance) return cachedInstance
  cachedInstance = ringConfigToInstanceConfig(getRingConfigSnapshot())
  return cachedInstance
}

/** @deprecated ring-config.json is the source file; kept for platform-settings seed compatibility. */
export function getInstanceConfigFromFile(): InstanceConfig {
  return ringConfigToInstanceConfig(getRingConfigSnapshot())
}

export function invalidateInstanceConfigCache(): void {
  cachedInstance = null
  cachedFromDb = null
  dbLoadAttempted = false
}

export function getBrandColors() {
  return getInstanceConfig().brand.colors
}

export function isFeatureEnabled(key: string, defaultValue = true): boolean {
  const { features } = getInstanceConfig()
  return features[key] ?? defaultValue
}

export function getPublicInstanceConfig(): PublicInstanceConfig {
  return toPublicInstanceConfig(getInstanceConfig())
}

/** Canonical public site origin — env overrides ring-config domains. */
export function getSiteBaseUrl(): string {
  const config = getRingConfigSnapshot()
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
}

export function getRingSeoBranding(): {
  siteName: string
  twitterSite: string
  ogImage: string
} {
  const config = getRingConfigSnapshot()
  return {
    siteName: config.seo?.siteName ?? config.clone?.displayName ?? 'Ring Platform',
    twitterSite: config.seo?.twitterHandle ?? '@RingPlatform',
    ogImage: config.seo?.ogImage ?? '/images/og-image.png',
  }
}

export function getSocialLinks(): {
  github: string
  twitter: string
  linkedin: string
  discord: string
  telegram: string
} {
  const social = getRingConfigSnapshot().social ?? {}
  return {
    github: social.github ?? '',
    twitter: social.twitter ?? '',
    linkedin: social.linkedin ?? '',
    discord: social.discord ?? '',
    telegram: social.telegram ?? '',
  }
}

export function getPlatformIdentity(): {
  name: string
  shortName: string
  domain: string
  demoUserEmail: string
} {
  const config = getRingConfigSnapshot()
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
  }
}

export function getRingTokenSymbol(): string {
  const config = getRingConfigSnapshot()
  return process.env.PAYMENT_TOKEN_SYMBOL || config.tokens?.ring?.symbol || 'RING'
}
