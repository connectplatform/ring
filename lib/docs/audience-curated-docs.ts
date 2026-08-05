/**
 * Audience-curated docs sidebar visibility + section order.
 *
 * The docs right-sidebar reads from this map to filter which articles appear
 * under each section for the active audience (`founder` / `developer`).
 *
 * Contract:
 *   - `AUDIENCE_CURATED_DOCS[audience][sectionSlug]` is the curated list of
 *     page slugs visible to that audience in that section.
 *   - **Object key order** = sidebar **section order** for that audience.
 *   - Sections **not** listed for an audience are **hidden** (no “show all”
 *     fallback — that leaked api/cli/development into Founder).
 *   - Articles with frontmatter `audience: both` (or unset) appear in BOTH
 *     audiences and should be placed in the same section in each map.
 *
 * SSoT: this map is derived from the human-readable curated indexes at
 *   `docs/{locale}/for-founders.mdx` and `docs/{locale}/for-developers.mdx`.
 * The MDX files are info sources (cross-linkable, future TODOs). The runtime
 * sidebar filtering consumes this TypeScript module.
 *
 * Index revision 2026-07-12: Founder prioritizes features → examples →
 * customization → web3 (operator product value). Developer = system layers.
 * Trace: chat 4632c32f Phase B + Emperor priority note 2026-07-12.
 *
 * The canonical reference for *available* pages is docs/{locale}/.../meta.json;
 * this module chooses which subset + order each audience sees.
 */

import type { DocsAudience } from '@/lib/docs/docs-audience'

export const AUDIENCE_CURATED_DOCS = {
  // ---------------------------------------------------------------
  // Founders — operators & decision-makers
  // Object key order = sidebar section order (top priority first).
  // ---------------------------------------------------------------
  founder: {
    'getting-started': [
      'prerequisites',
      'installation',
      'first-success',
      'next-steps',
    ],
    features: [
      // Make money
      'store',
      'inventory',
      'vendor-management',
      'commissions',
      'subscriptions',
      'payment-conductor',
      'ring-oracle',
      'payments',
      'public-pools',
      'wayforpay-integration',
      'wallet',
      'wallet-conductor',
      'affiliate-enablement',
      'refcodes',
      'nft-market',
      'nft-gates',
      'staking',
      'owner-project-lab',
      // Grow the network
      'entities',
      'opportunities',
      'messaging',
      'tasks',
      'webrtc-calls',
      'peer-games',
      'news',
      'member-blog',
      'public-profile',
      'profile-account',
      'file-cabinet',
      'username-reservation',
      'scientific-editor',
      // Reach members
      'notifications',
      'push-notifications-fcm',
      'email-ai-crm',
      'ring-mailer',
      'tunnel-protocol',
      'video-conductor',
      'media-conductor',
      'generative-media',
      // Trust & brand
      'authentication',
      'security',
      'admin',
      'admin-wiki',
      'manage-via-telegram',
      'locale-system',
      'mobile-experience',
      'performance',
    ],
    examples: [
      'quick-start',
      'basic-setup',
      'white-label',
      'custom-branding',
      'web3-integration',
      'real-world',
      'advanced-features',
    ],
    customization: [
      'quick-start',
      'customization-guide',
      'vertical-presets',
      'ringization-playbook',
      'branding',
      'themes',
      'features',
      'localization',
      'token-economics',
      'payment-integration',
      'success-stories',
    ],
    web3: ['token-launch-jurisdictions'],
    wallet: ['security-tips'],
    integrations: ['ethereum-wallets', 'ring-filebase', 'ring-cdn'],
    deployment: [
      'self-hosted',
      'vercel',
      'docker',
      'environment',
      'monitoring',
      'performance',
      'backup',
    ],
    // High-level only — no backend/api/cli for founders (ring-mcp is the exception: dual-audience AI ops)
    architecture: [
      'data-model',
      'security',
      'real-time',
      'discovery-mutation-sync',
      'payment-conductor',
      'wallet-conductor',
    ],
    // firebase-full operators need Hosting + Cloud Scheduler cron guidance
    backend: ['firebase'],
    // AI remote ops — dual-audience manuals founders need for clone control
    development: ['ring-mcp'],
  },

  // ---------------------------------------------------------------
  // Developers — engineers & integrators (system layers)
  // Object key order = sidebar section order.
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
      'proxy-and-intl',
      'payment-conductor',
      'wallet-conductor',
      'refcodes',
      'news-kingdom',
      'email-ai-crm',
    ],
    backend: ['k8s-postgres-fcm', 'firebase'],
    api: [
      'authentication',
      'entities',
      'opportunities',
      'messaging',
      'notifications',
      'wallet',
      'store',
      'admin',
      'email-ai-crm',
    ],
    features: [
      'payment-conductor',
      'ring-oracle',
      'wayforpay-integration',
      'subscriptions',
      'payments',
      'public-pools',
      'store',
      'inventory',
      'vendor-management',
      'commissions',
      'wallet',
      'wallet-conductor',
      'refcodes',
      'affiliate-enablement',
      'nft-market',
      'nft-gates',
      'staking',
      'owner-project-lab',
      'tunnel-protocol',
      'messaging',
      'tasks',
      'webrtc-calls',
      'peer-games',
      'push-notifications-fcm',
      'notifications',
      'email-ai-crm',
      'ring-mailer',
      'authentication',
      'security',
      'admin',
      'admin-wiki',
      'manage-via-telegram',
      'entities',
      'opportunities',
      'news',
      'member-blog',
      'public-profile',
      'profile-account',
      'file-cabinet',
      'username-reservation',
      'scientific-editor',
      'locale-system',
      'doc-system',
      'video-conductor',
      'media-conductor',
      'generative-media',
      'mobile-experience',
      'performance',
    ],
    deployment: [
      'environment',
      'self-hosted',
      'docker',
      'vercel',
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
      'workflow',
      'contributing',
      'deployment',
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
    mcp: ['ring-image-create', 'ring-video-create'],
    customization: [
      'quick-start',
      'customization-guide',
      'vertical-presets',
      'ringization-playbook',
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
    integrations: ['ethereum-wallets', 'ring-filebase', 'ring-cdn'],
    web3: ['token-launch-jurisdictions'],
    wallet: ['security-tips'],
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

/** Sidebar section order for an audience = curated map key order. */
export function getAudienceSectionOrder(audience: DocsAudience): readonly string[] {
  return Object.keys(AUDIENCE_CURATED_DOCS[audience])
}

/** Page slug order within a curated section (empty if section not curated). */
export function getCuratedPageOrder(
  audience: DocsAudience,
  sectionSlug: string,
): readonly string[] {
  const section = AUDIENCE_CURATED_DOCS[audience][
    sectionSlug as keyof (typeof AUDIENCE_CURATED_DOCS)[DocsAudience]
  ] as readonly string[] | undefined
  return section ?? []
}

/**
 * Curated page slugs for (audience, section).
 * `null` = section not curated → **hide** the section for that audience.
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

export function isArticleVisibleToAudience(
  audience: DocsAudience,
  sectionSlug: string,
  pageSlug: string,
): boolean {
  const curated = getCuratedPageSet(audience, sectionSlug)
  if (!curated) return false
  return curated.has(pageSlug)
}
