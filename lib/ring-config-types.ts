export type ProductFieldsPreset = 'platform' | 'agricultural'
export type ProductBadgesPreset = 'platform' | 'agricultural'

export interface SidebarLinkConfig {
  labelKey: string
  href: string
  icon?: string
}

export interface SidebarCommunityLinkConfig {
  labelKey: string
  urlKey: string
}

export type SidebarStatValueKey = 'clone.version' | 'legal.licenseSpdx'

export interface SidebarStatConfig {
  labelKey: string
  /** Literal display value (omit when using valueKey). */
  value?: string
  /** Resolved at runtime from ring-config (preferred for version/license). */
  valueKey?: SidebarStatValueKey
}

export interface RingBrandColors {
  primary: string
  background: string
  foreground: string
  accent: string
  primaryForeground?: string
  secondary?: string
  secondaryForeground?: string
  accentForeground?: string
  muted?: string
  mutedForeground?: string
  destructive?: string
  destructiveForeground?: string
  border?: string
  input?: string
  ring?: string
}

export interface RingBranding {
  logo?: {
    light?: string
    dark?: string
    favicon?: string
    appleTouchIcon?: string
  }
  colors?: RingBrandColors
  darkColors?: RingBrandColors
  fonts?: {
    sans?: string
    mono?: string
  }
}

export interface RingThemeConfig {
  default?: 'light' | 'dark' | 'system'
}

export interface RingNavigationLink {
  label: string
  href: string
}

export interface RingNavigationConfig {
  links?: RingNavigationLink[]
}

export interface RingHeroConfig {
  title?: string
  subtitle?: string
  ctaText?: string
  ctaHref?: string
  showOnHome?: boolean
}

/** Install-time matcher defaults — seeds platform_settings.ai and env-disabled resolution. */
export interface RingMatcherConfig {
  /** Match score floor for notifications / matching (0–1). Mirrors platform_settings.matcher.scoreThreshold. */
  scoreThreshold?: number
  /** Max matches per opportunity run. Mirrors platform_settings.matcher.maxMatches. */
  maxMatches?: number
  /**
   * When true, LLM-verified matches may promote pending → active (runtime toggle lives in DB;
   * this is the clone install default, default false).
   */
  autoApprove?: boolean
  /** Min match score for auto-approve gate (0–1). Compared against overallScore / 100 at runtime. */
  autoApproveMinScore?: number
  /** Min per-match LLM confidence to count as LLM path (matching-service uses 0.8 / 0.5 / 0.3). */
  llmConfidenceGate?: number
}

export interface RingLegalConfig {
  companyName?: string
  companyAddress?: string
  companyRegistration?: string
  licenseSpdx?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
  cookiePolicyUrl?: string
  gdprEnabled?: boolean
  ccpaEnabled?: boolean
}

/** Runtime whitelabel view — derived from ring-config (+ optional DB overlay on server). */
export type InstanceConfig = {
  name: string
  brand: {
    colors: RingBrandColors
    logoUrl?: string
    faviconUrl?: string
    ogImageUrl?: string
  }
  theme?: RingThemeConfig
  seo?: { titleSuffix?: string; defaultDescription?: string }
  navigation?: RingNavigationConfig
  hero?: RingHeroConfig
  features: Record<string, boolean>
}

/** Client-safe subset passed from server layout into AppClientShell. */
export type PublicInstanceConfig = {
  name: string
  brand: {
    colors: Pick<RingBrandColors, 'primary' | 'background' | 'foreground' | 'accent'>
    logoUrl?: string
    faviconUrl?: string
    ogImageUrl?: string
  }
  theme?: RingThemeConfig
  seo?: { titleSuffix?: string; defaultDescription?: string }
  navigation?: RingNavigationConfig
  hero?: RingHeroConfig
  features: Record<string, boolean>
}

export interface RingMembershipTierConfig {
  amount: number
  currency: string
  description: string
  duration: string
}

export interface RingMembershipConfig {
  tiers: {
    subscriber: RingMembershipTierConfig
    member: RingMembershipTierConfig
  }
}

export interface RingConfig {
  clone: {
    name: string
    displayName: string
    shortName?: string
    description?: string
    version?: string
    organization?: string
    /** Platform contact SSOT — support, legal, and transactional footers use this. */
    contactEmail?: string
  }
  branding?: RingBranding
  domains: {
    production?: string
    staging?: string
    development?: string
    cdn?: string
    api?: string
  }
  features: Record<string, unknown> & {
    expertServicesMarketplace?: boolean
  }
  localization?: Record<string, unknown>
  theme?: RingThemeConfig
  navigation?: RingNavigationConfig
  hero?: RingHeroConfig
  seo?: {
    siteName?: string
    siteDescription?: string
    siteKeywords?: string[]
    titleSuffix?: string
    ogImage?: string
    twitterHandle?: string
    googleSiteVerification?: string
    bingSiteVerification?: string
  }
  social?: {
    twitter?: string
    linkedin?: string
    github?: string
    discord?: string
    telegram?: string
  }
  legal?: RingLegalConfig
  database?: Record<string, unknown>
  storage?: Record<string, unknown>
  security?: Record<string, unknown>
  deployment?: Record<string, unknown>
  integrations?: Record<string, unknown> & {
    demoUserEmail?: string
  }
  platform?: {
    baseUrl?: string
  }
  tokens?: {
    ring?: {
      symbol?: string
      name?: string
      decimals?: number
    }
  }
  sidebar?: {
    quickLinks?: SidebarLinkConfig[]
    community?: SidebarCommunityLinkConfig[]
    stats?: SidebarStatConfig[]
  }
  calculator?: {
    enabled?: boolean
    presetId?: string | null
  }
  /** Public /roadmap marketing page — surfaced on /about when enabled. */
  roadmap?: {
    enabled?: boolean
  }
  productFields?: {
    preset?: ProductFieldsPreset
  }
  productBadges?: {
    preset?: ProductBadgesPreset
  }
  contact?: {
    address?: string
    phone?: string
    email?: string
    partners?: Array<{ name: string; logo: string; url?: string }>
  }
  /** Clone install defaults for AI matcher + auto-approval (runtime: platform_settings.ai). */
  matcher?: RingMatcherConfig
  /** WayForPay purchasable membership tiers (subscriber + member only). */
  membership?: RingMembershipConfig
  /** Founder / publisher contacts for RingWidgetsContact on /about and /about-publisher. */
  founders?: {
    primary?: RingWidgetsContactConfig
    /** Additional contacts (future co-founders, team). */
    team?: RingWidgetsContactConfig[]
  }
}

/** Install-time contact card props — mirrors ring-widgets/contact-schema (paths allowed for avatars). */
export type RingWidgetsContactConfig = {
  firstName?: string
  lastName?: string
  nickname?: string
  photoAvatar?: string
  xUsername?: string
  linkedInUsername?: string
  facebookUsername?: string
  instagramUsername?: string
  telegramUsername?: string
  whatsAppBusinessNumber?: string
  projectUsername?: string
  customLinks?: Array<{ uri: string; name: string; desc?: string }>
}
