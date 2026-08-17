
import type { ReactNode } from 'react'
import type { UserRolesArray } from '@/features/auth/user-role'
import ringConfig from '@/ring-config.json'
import type { BaseChainConfig, EnabledChains, EvmChainConfig, SolanaChainConfig } from '@/lib/ring-config-chain'

// =========================
// Vertical presets (Tier-1 ring-config + Tier-2 features/*/presets)
// =========================

/**
 * Vertical preset id — selects typed catalogs under features/…/presets/{id}.ts
 * Names registered in ENTITIES_PRESET_REGISTRY (and product field/badge maps).
 */
export type VerticalPresetId = 'platform' | string

/** Rails a collective order may offer — the config-level mirror of CollectiveOrderRail. */
export type CollectiveOrderConfigRail = 'credit_balance' | 'card' | 'paypal'

/** @deprecated Prefer VerticalPresetId for productFields.preset — this aliases store category strings historically. */
export type ProductFieldsPreset = (typeof ringConfig.productFieldsPresets.platform.storeCategories)[number]

/** Store category string from productFieldsPresets.<vertical>.storeCategories */
export type StoreCategoryId = ProductFieldsPreset

/** @deprecated Prefer VerticalPresetId for productBadges.preset — historically badge token strings. */
export type ProductBadgesPreset = (typeof ringConfig.productBadgesPresets.platform.productBadges)[number]

export type SupportedCurrencies = (typeof ringConfig.currencies)[number]['symbol'];

/** Supported crypto/token symbols from ring-config.json tokens.supported. */
export type SupportedCrypto = (typeof ringConfig.tokens.supported)[number];

/**
 * Fiat FX feed providers.
 * - nbu: National Bank of Ukraine (only when store.mainCurrency === 'UAH')
 * - open_er_api: open.er-api.com free global FX (default for non-UAH mains; XE has no free API)
 * - frankfurter: ECB-backed frankfurter.dev (no UAH — prefer open_er_api when UAH presentment needed)
 */
export type FxFeedProviderId = 'nbu' | 'open_er_api' | 'frankfurter'

export type FxFeedProviderConfig = {
  provider: FxFeedProviderId
  enabled?: boolean
  /** Re-fetch interval in hours; default 24. */
  refreshHours?: number
}

/**
 * Type for all vendor merchant payout rail types (layer/infrastructure, not product)
 * Used to describe how a payment is actually routed
 */
export type VendorMerchantPayoutRailType =
  | 'fiat_card'        // Credit/debit card payments (e.g. Stripe, WayForPay)
  | 'credit_balance'   // Internal system credit unit
  | 'native_token'     // Native on-chain token (e.g. SOL, ETH, ERC20)
  | 'nft_gate'         // NFT-gated access/payments
  | 'paypal'           // Paypal bridge
  | 'crypto_wallet';   // Generic crypto wallet

/**
 * Type for all user-facing vendor merchant payout method types (actual method user selects)
 * Subset/superset of payment rails. Use for user interaction or option lists.
 */
export type VendorAcceptedPaymentMethods = SupportedCurrencies | SupportedCrypto;

/**
 * Type for supported vendor merchant payout currencies (includes fiat and crypto)
 * - Used for presenting users with currency options, plus API currency field typing
 */
export type VendorMerchantPayoutCurrencyType = SupportedCurrencies | SupportedCrypto;

// =========================
// Sidebar Config Types
// =========================

// Sidebar link configuration (single link)
export interface SidebarLinkConfig {
  labelKey: string            // i18n key for link's label
  href: string                // Destination path/href
  /**
   * Icon for the sidebar link.
   * - string: icon name or image URL (legacy usage)
   * - ReactNode: passing a React element enables using inlined SVGs or icon components (modern usage)
   * 
   * Example:
   *   import { MyAwesomeIcon } from './icons/MyAwesomeIcon'
   *   const link: SidebarLinkConfig = {
   *     labelKey: 'sidebar.home',
   *     href: '/home',
   *     icon: <MyAwesomeIcon />,
   *   }
   */
  icon?: string | ReactNode
}

// Sidebar link for community section (external/public)
export interface SidebarCommunityLinkConfig {
  labelKey: string            // i18n key for label
  urlKey: string              // i18n key or static for actual URL
  // TODO: Evaluate using URL type for stricter type safety with Next.js 16 (native URL handling).
}

// Key options for sidebar stats display (used as reference for value lookups)
export type SidebarStatValueKey = 'clone.version' | 'legal.licenseSpdx'

// Sidebar statistic configuration - label + value
export interface SidebarStatConfig {
  labelKey: string            // i18n key for label
  /** Literal display value (omit when using valueKey). */
  value?: string              // Optional fixed value (string literal)
  /** Resolved at runtime from ring-config (preferred for version/license). */
  valueKey?: SidebarStatValueKey // Optional: If present, fetches value dynamically
  // TODO: Support async stat calculation using React 19 use() for SSR stats.
}

// =========================
// Branding Configuration
// =========================

// Color palette structure using CSS custom properties for theming/branding (React 19/Next 16)
export interface RingBrandColors {
  /**
   * Native CSS custom properties for theming.
   * Maps any branding color token to a CSS variable value (e.g., "var(--ring-primary)").
   * Example: { primary: 'var(--ring-primary)', background: 'var(--ring-bg)' }
   */
  [cssVar: `--${string}`]: string

  /**
   * Optional standard color tokens for convenience/typed usage.
   * All properties resolve to CSS custom properties at runtime.
   */
  primary?: string             // e.g., 'var(--ring-primary)'
  background?: string          // e.g., 'var(--ring-background)'
  foreground?: string          // e.g., 'var(--ring-foreground)'
  accent?: string              // e.g., 'var(--ring-accent)'
  primaryForeground?: string   // e.g., 'var(--ring-primary-foreground)'
  secondary?: string           // e.g., 'var(--ring-secondary)'
  secondaryForeground?: string // e.g., 'var(--ring-secondary-foreground)'
  accentForeground?: string    // e.g., 'var(--ring-accent-foreground)'
  muted?: string               // e.g., 'var(--ring-muted)'
  mutedForeground?: string     // e.g., 'var(--ring-muted-foreground)'
  destructive?: string         // e.g., 'var(--ring-destructive)'
  destructiveForeground?: string // e.g., 'var(--ring-destructive-foreground)'
  border?: string              // e.g., 'var(--ring-border)'
  input?: string               // e.g., 'var(--ring-input)'
  ring?: string                // e.g., 'var(--ring-ring)'
}

// Full branding configuration
export interface RingBranding {
  logo?: {
    light?: string           // Logo for light mode (URL/path)
    dark?: string            // Logo for dark mode
    favicon?: string         // Favicon (URL/path)
    appleTouchIcon?: string  // Apple touch icon
  }
  colors?: RingBrandColors       // Light theme colors
  darkColors?: RingBrandColors   // Optional dark mode overrides
  fonts?: {
    /**
     * Variable font family (recommended, uses fallback if unsupported in browser).
     * Example: "InterVariable, Inter, system-ui, sans-serif"
     */
    sansVariable?: string        // Variable sans-serif font stack
    /**
     * Fallback non-variable font family (used if variable font fails to load).
     * Example: "Inter, system-ui, sans-serif"
     */
    sans?: string                // Sans-serif font stack/family

    /**
     * Variable monospaced font family (recommended, with fallback).
     * Example: "JetBrainsMonoVariable, JetBrains Mono, ui-monospace, monospace"
     */
    monoVariable?: string        // Variable monospaced font stack
    /**
     * Fallback non-variable monospaced font family.
     * Example: "JetBrains Mono, ui-monospace, monospace"
     */
    mono?: string                // Monospace font stack/family
  }
  sidebar?: {
    stats?: SidebarStatConfig[]
  }
  navigation?: {
    links?: RingNavigationLink[]
  }
  hero?: {
    title?: string
    subtitle?: string
  }
  seo?: {
    titleSuffix?: string
    defaultDescription?: string
  }
  social?: {
    twitter?: string
  }
  legal?: {
    companyName?: string
    companyAddress?: string
    companyRegistration?: string
    licenseSpdx?: string
    privacyPolicyUrl?: string
    termsOfServiceUrl?: string
  }
  database?: {
    connection?: string
    engine?: string
    pubsub?: string
  }
  storage?: {
    object?: string
    file?: string
  }
  security?: {
    auth?: string
    secrets?: string
    loginPolicies?: string
  }
  deployment?: {
    mode?: 'development' | 'production' | 'staging'
    namespace?: string
    replicas?: number
    image?: string
    env?: Record<string, string>
    ports?: Record<string, number>
    volumes?: Record<string, string>
    resources?: Record<string, string>
    security?: Record<string, string>
    network?: Record<string, string>
    ingress?: Record<string, string>
    dns?: Record<string, string>
    monitoring?: Record<string, string>
    logging?: Record<string, string>
    tracing?: Record<string, string>
  }
  integrations?: {
    demoUserEmail?: string
  }
  // Next.js 16+: Uses variable fonts for performance with native font fallback.
}

// Theme configuration (default theme selection)
export interface ThemeConfig {
  default?: 'light' | 'dark' | 'system' // Default or system-theme option
  // TODO: Integrate with React 19 useTheme() where available.
}

export type SupportedLocale = (typeof ringConfig.localization.supportedLocales)[number];
export type DefaultLocale = (typeof ringConfig.localization.defaultLocale)[number];

// =========================
// Navigation and Hero
// =========================

// Type for single navigation link
export interface RingNavigationLink {
  label: string              // User-facing label (i18n value, or plain text)
  href: string               // Destination path or URL
}

// Navigation config schema: set of links for global site nav
export interface NavigationConfigSchema {
  links?: RingNavigationLink[]   // Optional navigation array
  // TODO: Support sections? Dynamic linking for future extensibility.
}

// Hero section config for landing/homepages
export interface RingHeroConfig {
  title?: string                // Main heading/title (i18n or plain)
  subtitle?: string             // Supporting subtitle
  ctaText?: string              // Call-to-action text
  ctaHref?: string              // CTA button/link href
  showOnHome?: boolean          // Show hero on homepage
}


// =========================
// AI Matcher Defaults
// =========================

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
  // TODO: Use Zod/Yup for schema validation for runtime type checks.
}

// =========================
// Legal and Company Metadata
// =========================

export interface LegalConfig {
  companyName?: string            // Full company legal name
  companyAddress?: string         // Street, city, country address
  companyRegistration?: string    // Company registration number
  licenseSpdx?: string            // SPDX license short-string (e.g., MIT)
  privacyPolicyUrl?: string       // Privacy policy link
  termsOfServiceUrl?: string      // Terms of service link
  cookiePolicyUrl?: string        // Cookie policy link
  gdprEnabled?: boolean           // GDPR flag for compliance
  ccpaEnabled?: boolean           // CCPA (California) compliance flag
  isoCountryCode?: string         // ISO 3166-1 alpha-2 country code
}

// =========================
// Deployment metadata/config (DevOps)
// =========================

export interface DeploymentConfig {
  mode?: 'development' | 'production' | 'staging'   // Deployment mode (env switch)
  namespace?: string                                // K8s namespace or logical grouping
  replicas?: number                                 // Replica count for scaling
  image?: string                                    // Docker image tag/reference
  env?: Record<string, string>                      // Environment variable mapping
  ports?: Record<string, number>                    // Named ports (name -> port)
  volumes?: Record<string, string>                  // Volume bindings/mounts
  resources?: Record<string, string>                // Resource constraints/limits
  security?: Record<string, string>                 // Security settings (policies/secrets)
  network?: Record<string, string>                  // Networking options (subnets, etc)
  ingress?: Record<string, string>                  // Ingress (LB/DNS/hostname config)
  dns?: Record<string, string>                      // DNS-related config
  monitoring?: Record<string, string>               // Monitoring endpoints/keys
  logging?: Record<string, string>                  // Logging endpoints/settings
  tracing?: Record<string, string>                  // Tracing providers/config
  // TODO: Investigate Next.js 16 deployment primitives for seamless zero-config scaling.
}

// =========================
// Third-Party/External Integration
// =========================

export interface FirebaseIntegrationConfig {
  /** Firebase Auth / general client (not required for FCM). */
  enabled?: boolean
  /** Cloud Messaging. Independent of Auth/Firestore. */
  fcmEnabled?: boolean
  /** Client Firestore. Independent of FCM. */
  firestoreEnabled?: boolean
}

export interface IntegrationConfig {
  enabled?: boolean               // Toggle for integration
  url?: string                    // Integration endpoint or base API
  demoUserEmail?: string          // Demo user login email (if available)
  demoUserPassword?: string       // MOCK CODE, TODO: Remove storing passwords in config; step 1: migrate to env or OAuth, step 2: scrub from sample schema.
  // TODO: For critical data, prefer Next.js 16 env/static settings and new secrets management API.
}

// =========================
// Whitelabel Instance Config
// =========================

/** 
 * Runtime whitelabel view — derived from ring-config (+ optional DB overlay on server).
 * Used for SSR as 'instanceConfig' for public pages and marketing.
 */
export type InstanceConfig = {
  name: string
  brand: {
    colors: RingBrandColors           // Full color palette for instance
    logoUrl?: string                  // Main logo asset (resolved via CDN/local)
    faviconUrl?: string               // Favicon asset
    ogImageUrl?: string               // OpenGraph/social share image
  }
  theme?: ThemeConfig                // App-wide theming
  seo?: { titleSuffix?: string; defaultDescription?: string }  // SEO defaults
  navigation?: NavigationConfigSchema // Header/navigation structure
  hero?: RingHeroConfig              // Homepage/landing hero config
  features: Record<string, boolean>  // Enabled features for the instance
  // TODO: Add runtime type guards for SSR/CSR hydration safety
}

/**
 * Client-safe subset passed from server layout into AppClientShell.
 * Only includes public-safe instance config fields.
 */
export type PublicInstanceConfig = {
  name: string
  brand: {
    colors: Pick<RingBrandColors, 'primary' | 'background' | 'foreground' | 'accent'> // Limited palette for client themeing
    logoUrl?: string
    faviconUrl?: string
    ogImageUrl?: string
  }
  theme?: ThemeConfig
  seo?: { titleSuffix?: string; defaultDescription?: string }
  navigation?: NavigationConfigSchema
  hero?: RingHeroConfig
  features: Record<string, boolean>
  // TODO: Use Next.js serverActions to deliver serialized config in <AppShell /> layout in Next.js 16.
}

// =========================
// Membership/Subscription Logic
// =========================

// Subscriber tier definition for free users
export interface SubscriberTierConfig {
  amount: number                 // Payment amount for this tier
  currency: string               // 3-char ISO currency (e.g., USD)
  description: string            // Short description for tier
  duration: string               // Validity period (e.g. 'monthly', 'yearly')
}
// Member tier definition for paid/privileged users
export interface MemberTierConfig {
  amount: number                 // Payment amount for this tier
  currency: string               // 3-char ISO currency (e.g., USD)
  description: string            // Short description for tier
  duration: string               // Validity period (e.g. 'monthly', 'yearly')
}
// Confidential tier definition for confidential users
export interface ConfidentialTierConfig {
  amount: number                 // Payment amount for this tier
  currency: string               // 3-char ISO currency (e.g., USD)
  description: string            // Short description for tier
  duration: string               // Validity period (e.g. 'monthly', 'yearly')
  requirements: {
    confidential: UserRolesArray.confidential         // Must be confidential user
  }
}

// Native token pricing for membership payments
export interface MembershipTokenPricing {
  /** Native tokens required for subscriber → member upgrade */
  memberUpgradeAmount: number
  /** Monthly subscription renewal in RING (defaults to memberUpgradeAmount) */
  subscriptionRenewalAmount?: number
  /** Annual upgrade in RING (defaults to round(monthly×12×0.8)) */
  annualUpgradeAmount?: number
}

// Top-level membership config container
/** NFT gate feature keys unlocked when a gate asset is staked in GateEscrow. */
export type NftGateFeature =
  | 'membership.member'
  | 'vendor.dagi'
  | 'vendor.deed'
  | 'vendor.license.annual'
  | 'vendor.license.quarterly'

export type NftGateSlug =
  | 'one-month-membership'
  | 'annual-membership'
  | 'lifetime-membership'
  | 'vendor-store-deed'
  | 'vendor-dagi-key'
  | 'vendor-annual-store-license'
  | 'vendor-quarterly-store-license'

export interface NftGateTemplate {
  slug: NftGateSlug
  name: string
  description: string
  /** Human RING amount; convert with tokens.nativeToken.decimals (8). */
  priceRing: number
  gateFeatures: NftGateFeature[]
  durationDays: number | null
  stakeRequired: true
  /** Membership SKUs are soulbound; vendor keys/licenses are tradeable later. */
  soulbound: boolean
  imagePrompt: string
  /** Current sellable Metaplex Core asset address for this template. */
  activeTemplateAsset?: string
}

/**
 * Solana Metaplex Core NFT gates (MVP-A).
 * Mint: createCollection + mintAsset. Stake: GateEscrow PDA — not NATIVE_NFT_APR.
 */
export interface NftGateConfig {
  enabled?: boolean
  /** Metaplex Core verified collection address. */
  collectionMint?: string
  /**
   * Canonical HTTPS URI for off-chain collection metadata JSON (name, symbol, image).
   * Explorer Symbol comes from this JSON — Core has no on-chain symbol field.
   */
  collectionUri?: string
  /**
   * NFT collection ticker intent (e.g. KEYS). Display/config only — not the RING payment token.
   */
  collectionSymbol?: string
  /** GateEscrow Anchor program id (optional until deployed). */
  gateEscrowProgramId?: string
  /** Documented PDA seeds, e.g. ['gate-escrow', user, asset]. */
  gateEscrowSeeds?: string[]
  /** Enables the Solana NFT Exhibition marketplace surfaces and actions. */
  marketplaceEnabled?: boolean
  /** GateMarket Anchor program id; empty means ledger-dev marketplace mode. */
  gateMarketProgramId?: string
  /** Squads/protocol fee recipient for secondary-market RING settlement. */
  marketplaceFeeRecipient?: string
  /** Disclosed secondary-market fee in basis points. */
  marketplaceFeeBps?: number
  /** Sponsor pays mint/stake/unstake SOL (buyer need not hold SOL). */
  sponsorFeePayer?: boolean
  /**
   * PoC: members may create on-platform Metaplex Core collections and mint/list
   * (lane M). KEYS vendor-gate resale remains a separate verified lane.
   */
  memberCollectionsEnabled?: boolean
  /** Cap of member-owned collections per user (default 3). */
  maxCollectionsPerMember?: number
  /** Cap of mints per member collection (default 50). */
  maxMintsPerCollection?: number
  templates?: NftGateTemplate[]
}

export interface MembershipConfig {
  tiers: {
    subscriber: SubscriberTierConfig
    member: MemberTierConfig
    /** Annual member fiat (20% off monthly×12). Optional — derived if omitted. */
    memberAnnual?: MemberTierConfig
    confidential: ConfidentialTierConfig
  }
  /** Runtime ring-config key (preferred). */
  ring?: MembershipTokenPricing
  /** Legacy alias — prefer `ring`. */
  nativeToken?: MembershipTokenPricing
  mainCurrency?: SupportedCurrencies
}

// =========================
// Multi-Chain Blockchain Support
// =========================

import type { NativeChain, NativeToken, TokenDeskConfig, SupportedChains, NativeChainConfig, DaoPoolsConfig } from './ring-config-chain'
import { RewardCreditAddEventRule, RewardCreditAddEventTrigger } from './zod/credit-reward-schemas'

// Re-export chain identity types so legacy `from '@/lib/ring-config-types'` imports keep working.
// TODO: Once all importers migrate, delete these re-exports and repoint callers to '@/lib/ring-config-chain' directly.
export type { NativeChain, SupportedChains, TokenDeskConfig } from './ring-config-chain'
// Multi-chain config root for blockchain/wallet support



// =========================
// Storage / WebP derivative SSOT
// =========================

/** Backend for persistent WebP sibling generation (not Next.js image optimizer). */
export type WebpDerivativeProvider = 'off' | 'sharp' | 'ringbase'

export interface WebpDerivativeConfig {
  /** Default `off` — sharp is never imported unless explicitly set to `sharp`. */
  provider?: WebpDerivativeProvider
  maxEdge?: number
  quality?: number
}

export interface StorageConfig {
  provider?: string
  maxFileSize?: string
  allowedMimeTypes?: string[]
  note?: string
  webpDerivative?: WebpDerivativeConfig
}

// =========================
// Master (main SSOT) RingConfig interface
// =========================

export interface ContactConfig {
  address?: string
  phone?: string
  email?: string
  partners?: Array<{ name: string; logo: string; url?: string }>
}

/** CRM channel processing profile for inbound IMAP. */
export type EmailCrmChannelFlow = 'standard' | 'ingest_only' | 'tasks_only'

export interface EmailCrmChannelConfig {
  id: string
  name: string
  enabled?: boolean
  flow?: EmailCrmChannelFlow
  imap: {
    host: string
    port: number
    user: string
    mailbox?: string
    tls?: boolean
  }
  smtp?: {
    host: string
    port: number
    user: string
    from?: string
  }
  /** Env prefix for secrets; default CRM_CHANNEL_<ID_UPPER>. */
  secretEnvPrefix?: string
}

export interface RingConfig {
  clone: {
    name: string                     // Unique identifier (slug)
    displayName: string              // UX pretty name
    shortName?: string               // Optional shortname (branding)
    description?: string             // Marketing or documentation blurb
    version?: string                 // Deploy/runtime version
    organization?: string            // Owning company/org.
    /** Platform contact SSOT — support, legal, and transactional footers use this. */
    contactEmail?: string            // Contact for platform support/compliance
    // TODO: Separate out public/private/internal metadata using object spread in config for SSR privacy.
  }
  branding?: RingBranding            // Platform-wide color/logo/font themes
  contact?: {
    address?: string            // Physical address
    phone?: string              // Phone number
    email?: string              // Contact email
    partners?: Array<{ name: string; logo: string; url?: string }> // Partner logos/links
  }
  /**
   * Multi-mailbox Email CRM (IMAP inbound). AUTH SMTP stays on SMTP_* / lib/mailer.
   * Channel passwords: env `${secretEnvPrefix}_PASSWORD` (default CRM_CHANNEL_<ID>).
   */
  emailCrm?: {
    enabled?: boolean
    channels?: EmailCrmChannelConfig[]
  }
  /**
   * Public /calculator feature shell (Tier B tool page).
   * SSOT is top-level — do not nest under features.
   */
  calculator?: {
    enabled?: boolean
    /** Preset id under features/calculator/presets/{id}.ts (e.g. project, deployment) */
    presetId?: string
  }
  /**
   * Opportunities type enablement + specialty defaults (Ring Opportunity Upgrade).
   * SSOT is top-level — white-label clones gate selectors via enabledTypes.
   */
  opportunities?: {
    enabledTypes?: string[]
    scheduledServices?: {
      categories?: string[]
    }
    collectiveOrder?: {
      defaultRails?: CollectiveOrderConfigRail[]
      minSlots?: number
      maxSlots?: number
    }
  }
  domains: {
    production?: string              // Main production domain (https)
    staging?: string                 // Staging/test domain
    development?: string             // Dev/test domain
    cdn?: string                     // CDN/perf assets
    api?: string                     // API host/root
    // TODO: Refactor to domain[] array for future multi-env support.
  }
  /** Supported fiat currencies — array of {symbol, name, decimals}. */
  currencies?: Array<{ symbol: SupportedCurrencies; name: string; decimals: number }>
  /** Exchange rates relative to MAIN_CURRENCY (rate == 1 for base). */
  exchangeRates?: Record<string, number>
  /**
   * Fiat FX feeds + manual overrides.
   * getExchangeRates resolution: static exchangeRates → live feed overlay → manualOverrides.
   *
   * Provider selection (extensible per-main-currency map):
   * 1. fx.byMainCurrency[mainCurrency]
   * 2. else if mainCurrency === 'UAH' → nbu
   * 3. else fx.default → open_er_api
   */
  fx?: {
    byMainCurrency?: Partial<Record<string, FxFeedProviderConfig>>
    default?: Partial<FxFeedProviderConfig> & { provider?: FxFeedProviderId }
    /** @deprecated Prefer byMainCurrency / default. */
    feed?: Partial<FxFeedProviderConfig> & { provider?: FxFeedProviderId }
    manualOverrides?: Record<string, number>
  }
  features: Record<string, unknown> & {
    expertServicesMarketplace?: boolean   // Example feature flag (marketplace)
    roadmap?: {
      enabled?: boolean
    }
    news?: {
      enabled?: boolean
    }
    admin?: {
      enabled?: boolean
    }
    analytics?: {
      enabled?: boolean
    }
    entities?: {
      enabled?: boolean
    }
    opportunities?: {
      enabled?: boolean
    }
    products?: {
      enabled?: boolean
    }
    users?: {
      enabled?: boolean
    }
    settings?: {
      enabled?: boolean
    }
    billing?: {
      enabled?: boolean
    }
    notifications?: {
      enabled?: boolean
    }
    reports?: {
      enabled?: boolean
    }
    integrations?: {
      enabled?: boolean
    }
  }
  localization?: Record<string, unknown> // I18n, L10n dictionary/overrides
  theme?: ThemeConfig                   // Default theme (see above)
  navigation?: NavigationConfigSchema   // Top-level navigation links/sections
  hero?: RingHeroConfig                // Home page/marketing hero section
  seo?: {
    siteName?: string                  // Site or clone display name
    siteDescription?: string           // Main metaDescription (SEO)
    siteKeywords?: string[]            // Extra tags/keywords (SEO)
    titleSuffix?: string               // Postfix for <title> for branding
    ogImage?: string                   // Default OpenGraph image
    twitterHandle?: string             // Twitter/X username (SEO)
    googleSiteVerification?: string    // Google site verification key
    bingSiteVerification?: string      // Bing site verification key

    // Enhanced: Favicon and web app manifest auto-generation config for Next.js 16 plugin API.
    favicon?: {
      src: string                      // Path/URL to source favicon (will be transformed for sizes)
      backgroundColor?: string         // Optional background (for SVG->PNG)
      themeColor?: string              // Optional browser theme color
      maskIconColor?: string           // Safari pinned tab mask color
      appleTouchIcon?: string          // Path/URL for Apple touch icon override
      manifestIcons?: Array<{
        src: string
        sizes: string                  // e.g. '192x192', '512x512'
        type: string                   // e.g. 'image/png', 'image/svg+xml'
        purpose?: string               // e.g. 'any', 'maskable'
      }>
    }
    manifest?: {
      name?: string                    // App name
      short_name?: string              // Short app name
      start_url?: string               // Start URL
      display?: 'standalone' | 'minimal-ui' | 'fullscreen' | 'browser'
      background_color?: string
      theme_color?: string
      orientation?: string
      icons?: Array<{
        src: string
        sizes: string
        type: string
        purpose?: string
      }>
      description?: string
      lang?: string
    }
  }
  social?: {
    twitter?: string
    linkedin?: string
    github?: string
    discord?: string
    telegram?: string
    // TODO: Use object field for arbitrary new social networks.
  }
  legal?: LegalConfig                  // Company legal/DMCA/disclosure metadata
  database?: Record<string, unknown>   // DB config (connection, engine, pub/sub) – schema left open for infra team
  /** Object/file storage SSOT — provider + optional WebP sibling derive strategy. */
  storage?: StorageConfig
  security?: Record<string, unknown>   // Platform security (auth, secrets, login policies)
  deployment?: DeploymentConfig        // Ops/config (see above)
  integrations?: Record<string, unknown> & {
    demoUserEmail?: string             // Demo user email (login as demo)
    firebase?: FirebaseIntegrationConfig
  }
  platform?: {
    baseUrl?: string                   // Canonical platform URL
  }
  credits?: {
    rewards?: {
      events?: Record<RewardCreditAddEventTrigger, RewardCreditAddEventRule>
      minRole?: string
      multipliers?: Record<string, number>
      dailyEarnCap?: Record<string, number>
    }
    unit?: string
    fiatUnit?: string
  }
  /**
   * Fiat credit ledger SSOT (singular key used by ring-config.json).
   * Points are denominated in store.mainCurrency; creditBalanceUnitToMainCurrency is the
   * multiplier for ledger `main_currency_equivalent` / accounting (typically 1 = 1:1).
   * Write-path for activity rewards: credit.rewards (events + multipliers + caps).
   */
  credit?: {
    creditBalanceUnitLabel?: string
    /** How many units of store.mainCurrency one credit point equals (usually 1). */
    creditBalanceUnitToMainCurrency?: number
    /** @deprecated Prefer credit.rewards.events — kept for dual-read during migration. */
    creditAddEvents?: Record<string, unknown>
    rewards?: {
      minRole?: string
      multipliers?: Record<string, number>
      dailyEarnCap?: Record<string, number>
      events?: Record<RewardCreditAddEventTrigger, RewardCreditAddEventRule>
    }
    desk?: TokenDeskConfig & { creditBalanceUnitPerNativeToken?: number }
  }
  tokens?: {
    supported?: SupportedCrypto[]
    tokenDesk?: Record<SupportedChains, TokenDeskConfig>    // Desk/trade/swap config for native token UX
    nativeToken?: {
      tokenSymbol?: string
      tokenName?: string
      tokenAddress?: string
      tokenDecimals?: number
      tokenProgram?: string
      tokenTreasuryAddress?: string
      tokenRpcUrlEnv?: string
    }
    evmToken?: {
      tokenSymbol?: string
      tokenName?: string
      tokenAddress?: string
      tokenDecimals?: number
      tokenProgram?: string
      tokenTreasuryAddress?: string
      tokenRpcUrlEnv?: string
    }
    baseToken?: {
      tokenSymbol?: string
      tokenName?: string
      tokenAddress?: string
      tokenDecimals?: number
      tokenProgram?: string
      tokenTreasuryAddress?: string
      tokenRpcUrlEnv?: string
    }
  }
  supportedChains?: SupportedChains[]  // Active crypto/token currencies (e.g. ['RING'])
  supportedCurrencies?: SupportedCurrencies[]    // Active fiat currencies (e.g. ['USD', 'UAH'])
  /**
   * Entities vertical — selects features/entities/presets/{preset}.ts
   * Tier-1 SSOT key; do not put full catalogs in ring-config.
   */
  entities?: {
    preset?: VerticalPresetId | string
  }
  /** Home landing preset — selects components/pages/home-presets/{preset}.tsx (default "platform") */
  home?: {
    preset?: 'platform' | string
  }
  /**
   * L2 pack id under ring-presets/<pack>/ (compose between L1 and L3).
   * Omit on two-layer clones (n9life, platform-org). Examples: mvm-agricultural, news-station.
   * Not a community preset — L1 platform is the only community default.
   */
  presets?: {
    pack?: string
  }
  /** Tier-3 overlay runtime id. Clones set overlay.featureId (e.g. n9life, vikka). */
  overlay?: {
    featureId?: string
  }
  productFields?: {
    /** Vertical id: platform | agricultural | … */
    preset?: VerticalPresetId | string
  }
  productBadges?: {
    /** Vertical id: platform | agricultural | … */
    preset?: VerticalPresetId | string
  }
  /** Tier-1 maps: productFieldsPresets.<vertical>.storeCategories */
  productFieldsPresets?: Record<string, { storeCategories?: string[] }>
  /** Tier-1 maps: productBadgesPresets.<vertical>.productBadges */
  productBadgesPresets?: Record<string, { productBadges?: string[] }>
  /** Clone install defaults for AI matcher + auto-approval (runtime: platform_settings.ai). */
  matcher?: RingMatcherConfig
  /** Future-feature public pool thresholds (docs backlog chip-ins / likes). */
  daoPools?: DaoPoolsConfig
  /** WayForPay purchasable membership tiers (subscriber + member only). */
  membership?: MembershipConfig
  /** Multi-chain wallet + Native-token rails (Solana native, EVM legacy, Base stub). */
  chains?: {
    /** Canonical native chain. Type-fixed 2026-07-03 — was the broken
     *  NativeChainConfig['nativeChain']['solana'] indexed type. */
    native: NativeChain
    enabled: EnabledChains[]
    supported: SupportedChains[]
    solana: SolanaChainConfig
    evm: EvmChainConfig
    base: BaseChainConfig
  }
  /** Founder / publisher contacts for RingWidgetsContact on /about and /about-publisher. */
  founders?: {
    primary?: RingWidgetsContactConfig
    /** Additional contacts (future co-founders, team). */
    team?: RingWidgetsContactConfig[]
  }
  /** Multi-provider payment gateway & subscription billing configuration. */
  payment?: PaymentConfig
  /**
   * Solana Metaplex Core NFT gate templates (MVP-A).
   * Mint SSOT: Metaplex Core createCollection + mintAsset.
   * Stake SSOT: GateEscrow PDA (not NATIVE_NFT_APR product vault).
   */
  nft?: NftGateConfig
  /** Store settings — configurable options for store checkout behavior. */
  store?: {
    storeCategories?: ProductFieldsPreset[]
    mainCurrency?: SupportedCurrencies[number]
    /**
     * USD per 1 main-currency unit (bridge for Chainlink TOKEN/USD → main).
     * When main is USD, treat as 1. Manual admin override preferred over cron FX.
     */
    mainCurrencyToUsd?: number
    /** Order currencies the `credit_balance` rail may settle. */
    creditBalanceAcceptedOrderCurrencies?: VendorAcceptedPaymentMethods[]
  }
  /** Price oracle configuration — multi-chain price feeds. */
  nativeTokenPriceOracle?: NativeTokenPriceOracleConfig
  /** Airdrops configuration — user-credit-balance airdrops for completed actions. */
  rewardCreditAddEvents?: Record<RewardCreditAddEventTrigger, RewardCreditAddEventRule>
  /**
   * Auth rail settings — phone login virtual-email domain SSOT.
   * Example (GreenFood): `{ "virtualEmailDomain": "greenfood.live" }`
   */
  auth?: {
    /** Domain for `{e164Digits}@{domain}` phone-only accounts. Required for phone login clones. */
    virtualEmailDomain?: string
  }
  // TODO: Split admin-only props to RingConfigAdmin – safer SSR/CSR.
}

// ============================================================================
// PAYMENT & SUBSCRIPTION CONFIG (Phase R0 — ring-config.json SSOT)
// ============================================================================

/** Supported membership payment providers — SSOT enum for ring-config. */
export type MembershipPaymentProvider =
  | 'stripe'
  | 'wayforpay'
  | 'credit_balance'
  | 'native_token'
  | 'nft_gate'
  | 'paypal'
  | 'telegram_stars'
// TODO: Use template literal types if supporting custom/extension providers in the future.

/** Per-gateway fee structure for admin net-revenue calculation. */
export interface PaymentGatewayConfig {
  enabled: boolean              // Toggle for provider
  /** Gateway fee as percent (e.g. 2.9 for Stripe). */
  feePercent: number            // Percentage fee rate
  /** Optional fixed fee in cents of the gateway's currency. */
  feeFixedCents?: number        // Optional: $0.30 fallbacks etc
  /** ISO 4217 currency the gateway charges in. */
  currency: SupportedCurrencies              // e.g. USD, EUR
  /** Display label override (e.g. "Tokens" for Native Token). */
  label?: string                // UX label for payment option
  // TODO: Build out dynamic gateway registration (React 19 server components pattern).
}

/** Payment method providers for fiat card payments. */
export type CardPaymentProcessor = 'wayforpay' | 'stripe'
// TODO: Extend to union type or generic for 3rd-party bridge support (Apple Pay, Google Pay).

/** Store settings — configurable options for store checkout behavior. */
export interface StoreSettingsConfig {
  /** Which order currencies the user credit balance can pay for (ISO 4217 codes). */
  creditBalanceAcceptedOrderCurrencies?: string[]
  /** Default currency for store orders. */
  mainCurrency?: SupportedCurrencies

  // TODO: Add experience-level currency choice (locale-based) with Next.js 16 i18n static routing.
}

/** Price oracle configuration — multi-chain price feeds. */
export interface NativeTokenPriceOracleConfig {
  /** Chain-specific oracle configuration (typed SSOT used by native-token-oracle / native-token-chainlink-oracle). */
  chains?: Record<number, {
    cache?: {
      enabled?: boolean | true
      ttl: number
    }
    chainlink?: {
      enabled: boolean
      feedAddress?: string
      aggregatorAbi?: any[]
      // TODO: Type ABI directly for safety.
    }
    fallbacks?: {
      enabled: boolean
      coingecko: boolean
      coinmarketcap: boolean
      binance: boolean
      // TODO: Add support for new fallback providers as required.
    }
    rpcUrl?: string
  }>
  /** Default chain ID for native-token/USD price. */
  defaultChain?: number
  /**
   * Legacy / narrative shape still present in some ring-config.json files.
   * Prefer `chains[chainId].chainlink.feedAddress`; service merges `evm.aggregatorAddress`.
   */
  solana?: {
    enabled?: boolean
    provider?: string
    priceFeedId?: string
    refreshIntervalSeconds?: number
  }
  evm?: {
    enabled?: boolean
    provider?: string
    aggregatorAddress?: string
    refreshIntervalSeconds?: number
  }
}

/** Trigger types for user-credit-balance add events. */
export type RewardCreditRuleType =
  'adminVerify'           // Admin has verified user
  | 'ringUsername'        // User has set a ring username
  | 'profileCompleted'    // User completed their profile
  | 'eventParticipation'  // User attended or participated in an event
  | 'referral'            // Referral logic (not yet enabled)
  | 'bonus'               // Misc/bonus events

  // TODO: Convert to enum when supporting large numbers for more perf safety

/** Top-level payment configuration — driven by ring-config.json SSOT. */
export interface PaymentConfig {
  /** Default card payment processor for membership checkout. */
  cardPaymentProcessor: CardPaymentProcessor
  /** Which membership payment methods are available to users. */
  supportedMethods: MembershipPaymentProvider[]
  /** Payment methods that are listed as upcoming features in docs. */
  futureMethods?: MembershipPaymentProvider[]
  /** Per-gateway fee rate configuration for admin revenue dashboards. */
  gateways: Partial<Record<MembershipPaymentProvider, PaymentGatewayConfig>>
  /** Default recurring billing frequency (WayForPay regularMode). */
  regularMode?: 'monthly' | 'yearly'
  // TODO: Refactor for composability w/ React 19 server actions for admin.
}

/**
 * Install-time contact card props — mirrors ring-widgets/contact-schema (paths allowed for avatars).
 * Used for founder/partner bios, support cards, etc.
 */
export type RingWidgetsContactConfig = {
  firstName?: string                          // First/given name
  lastName?: string                           // Surname/family name
  nickname?: string                           // Common/nickname/handle
  photoAvatar?: string                        // Avatar/photo (URL/path)
  xUsername?: string                          // X/Twitter handle
  linkedInUsername?: string                   // LinkedIn handle
  facebookUsername?: string                   // Facebook username
  instagramUsername?: string                  // IG handle
  telegramUsername?: string                   // Telegram
  whatsAppBusinessNumber?: string             // Whatsapp business number
  projectUsername?: string                    // On-platform username/ID
  customLinks?: Array<{
    uri: string;                              // URL to profile/link
    name: string;                             // Display label
    desc?: string                             // Optional description for link
  }>
  // TODO: Upgrade to new Next.js social linking primitives as API matures.
}
