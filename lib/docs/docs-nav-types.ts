/** Serializable docs sidebar navigation payload (server → client). */

export interface DocsNavItem {
  href: string
  label: string
  external?: boolean
}

export interface DocsNavSection {
  title: string
  href: string
  items: DocsNavItem[]
}

export interface DocsNavigationData {
  topPinnedLinks: DocsNavItem[]
  navSections: DocsNavSection[]
  quickLinks: DocsNavItem[]
  searchPlaceholder: string
  quickLinksTitle: string
}
