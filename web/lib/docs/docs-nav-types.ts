/** Serializable docs sidebar navigation payload (server → client). */

export interface DocsNavItem {
  href: string
  label: string
  /**
   * Page slug under `docs/{locale}/{sectionSlug}/{pageSlug}`.
   * SSoT: the tree sets this from `meta.json` so consumers (e.g. the audience
   * filter) can match on the slug directly without re-parsing `href`.
   * For section hub items (the section's `index.mdx`), this is `'index'`.
   */
  pageSlug: string
  external?: boolean
}

export interface DocsNavSection {
  title: string
  href: string
  /** Section slug under `docs/{locale}/` — used for audience-curated filtering. */
  sectionSlug: string
  items: DocsNavItem[]
}

export interface DocsNavigationData {
  topPinnedLinks: DocsNavItem[]
  navSections: DocsNavSection[]
  quickLinks: DocsNavItem[]
  searchPlaceholder: string
  quickLinksTitle: string
}
