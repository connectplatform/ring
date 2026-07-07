/**
 * Audience-curated docs sidebar visibility.
 *
 * The docs right-sidebar reads from this map to filter which articles appear
 * under each section for the active audience (`founder` / `developer`).
 *
 * Contract:
 *   - `AUDIENCE_CURATED_DOCS[audience][sectionSlug]` is the curated list of
 *     page slugs visible to that audience in that section.
 *   - Articles with frontmatter `audience: both` (or unset) appear in BOTH
 *     audiences and should be placed in the same section in each map.
 *   - Articles with frontmatter `audience: founder` only appear under
 *     `AUDIENCE_CURATED_DOCS.founder`.
 *   - Articles with frontmatter `audience: developer` only appear under
 *     `AUDIENCE_CURATED_DOCS.developer`.
 *   - Sections not present for an audience are hidden from that audience's
 *     sidebar entirely.
 *
 * SSoT: this map is derived from the human-readable curated indexes at
 *   `docs/{locale}/for-founders.mdx` and `docs/{locale}/for-developers.mdx`.
 * The MDX files are info sources (cross-linkable, future TODOs). The runtime
 * sidebar filtering consumes this TypeScript module.
 *
 * `as const` on the data below narrows each section's page-slug list to a
 * readonly tuple of literal strings, giving `isArticleVisibleToAudience` exact
 * type inference.
 * 
 *  * NOTE: This module extends the ring-docs-enhancer agent's architecture.
 * The agent's content-filtering uses <Audience for="…"> blocks within
 * individual MDX files (the SSoT approach — "one file, both audiences").
 *
 * This module adds an additional *nav-level* filter: when the sidebar
 * audience toggle is set, it also hides entire articles that have no
 * content targeting the active audience. This is distinct from the agent's
 * content-level filter and adds maintenance burden — every article
 * added/removed from a section via meta.json must also be reflected here.
 *
 * The canonical reference for sidebar content is docs/{locale}/ * /meta.json.
 *
 * TODO(future): derive the section→page-slug map at build time from the MDX
 * frontmatter `audience:` field. The current manual curation is more
 * expressive (per-section ordering, audience-specific section grouping) but
 * adds maintenance cost when articles are added/removed. Auto-derivation
 * could be the base, with a manual override map layered on top.
 */

import type { DocsAudience } from '@/lib/docs/docs-audience'

export const AUDIENCE_CURATED_DOCS = {
  // ---------------------------------------------------------------
  // Founders — operators & decision-makers (business value focus)
  // ---------------------------------------------------------------
  founder: {
    'getting-started': [
      'prerequisites',
      'installation',
      'first-success',
      'next-steps',
    ],
    features: [
      // Revenue & commerce
      'subscriptions',
      'payment-conductor',
      'store',
      'affiliate-enablement',
      'refcodes',
      'payments',
      'wallet',
      'nft-market',
      'staking',
      // Audience & community
      'entities',
      'opportunities',
      'messaging',
      'member-blog',
      'public-profile',
      'username-reservation',
      'scientific-editor',
      'news',
      // Reach & engagement
      'notifications',
      'push-notifications-fcm',
      'email-ai-crm',
      'tunnel-protocol',
      'video-conductor',
      // Trust & localization
      'authentication',
      'security',
      'locale-system',
      'mobile-experience',
      'performance',
    ],
    architecture: [
      'data-model',
      'security',
      'real-time',
      'discovery-mutation-sync',
    ],
    deployment: [
      'self-hosted',
      'vercel',
      'docker',
      'monitoring',
      'performance',
      'backup',
    ],
    customization: [
      'quick-start',
      'customization-guide',
      'branding',
      'themes',
      'token-economics',
      'payment-integration',
      'success-stories',
    ],
    integrations: [
      'ethereum-wallets',
    ],
    examples: [
      'quick-start',
      'white-label',
      'real-world',
      'custom-branding',
    ],
    wallet: [
      'security-tips',
    ],
    web3: [
      'token-launch-jurisdictions',
    ],
  },

  // ---------------------------------------------------------------
  // Developers — engineers & integrators (code & schema focus)
  // ---------------------------------------------------------------
  developer: {
    'getting-started': [
      'prerequisites',
      'installation',
      'migrations',
      'first-success',
      'troubleshooting',
      'next-steps',
    ],
    architecture: [
      'backend-modes-and-databases',
      'data-model',
      'data-validation',
      'authentication',
      'security',
      'real-time',
      'discovery-mutation-sync',
      'email-ai-crm',
      'payment-conductor',
      'refcodes',
      'news-kingdom',
      'proxy-and-intl',
    ],
    backend: [
      'k8s-postgres-fcm',
    ],
    api: [
      'authentication',
      'email-ai-crm',
      'entities',
      'opportunities',
      'messaging',
      'notifications',
      'wallet',
      'store',
      'admin',
    ],
    features: [
      // Payments & subscriptions
      'subscriptions',
      'payment-conductor',
      'wayforpay-integration',
      'refcodes',
      'affiliate-enablement',
      'payments',
      'wallet',
      'nft-market',
      'staking',
      // Realtime & communication
      'tunnel-protocol',
      'push-notifications-fcm',
      'notifications',
      'messaging',
      'email-ai-crm',
      // Identity & content
      'authentication',
      'security',
      'entities',
      'opportunities',
      'news',
      'member-blog',
      'public-profile',
      'username-reservation',
      'scientific-editor',
      'locale-system',
      'doc-system',
      // Media & automation
      'video-conductor',
      'store',
      'mobile-experience',
      'performance',
      // ERP (nested sub-section)
      'inventory',
      'vendor-management',
      'commissions',
    ],
    deployment: [
      'self-hosted',
      'vercel',
      'docker',
      'environment',
      'monitoring',
      'performance',
      'backup',
    ],
    development: [
      'local-setup',
      'code-structure',
      'code-style',
      'best-practices',
      'testing',
      'debugging',
      'performance',
      'deployment',
      'contributing',
      'workflow',
      'docs-components',
      'community-tooling',
      'ring-mcp',
      'whitelabel-navigation',
      'oss-vs-enterprise',
      'generative-images',
      'generative-newsroom',
      'generative-videos',
      'scripted-media-pipeline',
    ],
    mcp: [
      'ring-image-create',
      'ring-video-create',
    ],
    customization: [
      'quick-start',
      'customization-guide',
      'database-selection',
      'token-economics',
      'payment-integration',
      'ai-customization',
      'branding',
      'features',
      'localization',
      'themes',
      'components',
    ],
    integrations: [
      'ethereum-wallets',
    ],
    web3: [
      'token-launch-jurisdictions',
    ],
    wallet: [
      'security-tips',
    ],
    examples: [
      'quick-start',
      'basic-setup',
      'authentication',
      'email-ai-crm',
      'api-integration',
      'api-examples',
      'web3-integration',
      'white-label',
      'custom-branding',
      'apple-signin-integration',
      'integrations',
      'real-world',
      'advanced-features',
    ],
  },
} as const satisfies Readonly<Record<DocsAudience, Readonly<Record<string, readonly string[]>>>>

export type CuratedPageSet = ReadonlySet<string>

/**
 * Get a memoized `Set` of page slugs curated for a (audience, section) pair.
 * `null` means the section is not curated for the audience — consumers should
 * fall back to showing all items in that section.
 */
export function getCuratedPageSet(
  audience: DocsAudience,
  sectionSlug: string,
): CuratedPageSet | null {
  const section = AUDIENCE_CURATED_DOCS[audience][
    sectionSlug as keyof (typeof AUDIENCE_CURATED_DOCS)[DocsAudience]
  ] as readonly string[] | undefined
  if (!section) return null
  return new Set(section)
}

/**
 * Test whether an article (identified by its section + page slug) is visible
 * to the given audience. Returns `true` if the article should appear in that
 * audience's sidebar.
 */
export function isArticleVisibleToAudience(
  audience: DocsAudience,
  sectionSlug: string,
  pageSlug: string,
): boolean {
  const curated = getCuratedPageSet(audience, sectionSlug)
  if (!curated) return false
  return curated.has(pageSlug)
}
