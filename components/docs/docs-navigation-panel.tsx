'use client'

import React, { useDeferredValue, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import { Link, usePathname } from '@/i18n/routing'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import DocsAudienceSelector from '@/components/docs/docs-audience-selector'
import { useDocsAudienceOptional } from '@/components/docs/docs-audience-context'
import { isDocsNavItemActive, normalizeDocsNavPath } from '@/lib/docs/docs-nav-active'
import { getCuratedPageSet } from '@/lib/docs/audience-curated-docs'
import type {
  DocsNavItem,
  DocsNavSection,
  DocsNavigationData,
} from '@/lib/docs/docs-nav-types'
import type { DocsAudience } from '@/lib/docs/docs-audience'

type DocsLinkHref = ComponentProps<typeof Link>['href']

function matchesTitle(label: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return label.toLowerCase().includes(q)
}

function filterItems(items: DocsNavItem[], query: string): DocsNavItem[] {
  if (!query.trim()) return items
  return items.filter((item) => matchesTitle(item.label, query))
}

/**
 * Filter a section's items by the active audience's curated set.
 * If the section is not present in the audience's curated map, ALL items
 * are kept (fallback for sections not yet curated).
 * If the section IS in the curated map, only items whose `pageSlug` is in the
 * curated list are kept. SSoT: the `pageSlug` is set by the navigation tree
 * from `meta.json` — no href re-parsing.
 */
function filterItemsByAudience(
  items: DocsNavItem[],
  sectionSlug: string,
  audience: DocsAudience | null,
): DocsNavItem[] {
  if (!audience) return items
  const curated = getCuratedPageSet(audience, sectionSlug)
  if (!curated) {
    // No curated list for this section — keep all items (graceful fallback)
    return items
  }
  return items.filter((item) => curated.has(item.pageSlug))
}

function filterSections(
  sections: DocsNavSection[],
  query: string,
  audience: DocsAudience | null,
): DocsNavSection[] {
  // 1) Apply audience filter first (only when audience is set)
  const audienceFiltered = audience
    ? sections
        .map((section) => {
          const items = filterItemsByAudience(section.items, section.sectionSlug, audience)
          if (items.length === 0) return null
          return { ...section, items }
        })
        .filter((section): section is DocsNavSection => section !== null)
    : sections

  // 2) Apply search query filter on the audience-filtered set
  if (!query.trim()) return audienceFiltered
  return audienceFiltered
    .map((section) => {
      const sectionMatches = matchesTitle(section.title, query)
      const items = sectionMatches
        ? section.items
        : section.items.filter((item) => matchesTitle(item.label, query))
      if (items.length === 0 && !sectionMatches) return null
      return { ...section, items: sectionMatches ? section.items : items }
    })
    .filter((section): section is DocsNavSection => section !== null)
}

export default function DocsNavigationPanel({
  topPinnedLinks,
  navSections,
  quickLinks,
  searchPlaceholder,
  quickLinksTitle,
}: DocsNavigationData) {
  const [query, setQuery] = useState('')
  const pathname = usePathname()
  const audienceCtx = useDocsAudienceOptional()
  const audience: DocsAudience | null = audienceCtx?.audience ?? null
  const activePath = useMemo(
    () => normalizeDocsNavPath(pathname ?? ''),
    [pathname],
  )

  // Defer the search query so typing stays responsive while filtering runs.
  // React 19 `useDeferredValue` is preferred over `useTransition` for
  // value-debouncing — works seamlessly with concurrent rendering.
  const deferredQuery = useDeferredValue(query)
  const isSearchStale = query !== deferredQuery

  // Pre-filter by audience once (no search) — audience toggle is rare + cheap.
  const audienceFilteredSections = useMemo(
    () =>
      audience
        ? navSections
            .map((section) => {
              const items = filterItemsByAudience(section.items, section.sectionSlug, audience)
              if (items.length === 0) return null
              return { ...section, items }
            })
            .filter((section): section is DocsNavSection => section !== null)
        : navSections,
    [navSections, audience],
  )

  // Apply the (deferred) search query on top of the audience-filtered set.
  const filteredPinned = useMemo(
    () => filterItems(topPinnedLinks, deferredQuery),
    [topPinnedLinks, deferredQuery],
  )
  const filteredSections = useMemo(
    () => filterSections(audienceFilteredSections, deferredQuery, null),
    [audienceFilteredSections, deferredQuery],
  )
  const filteredQuick = useMemo(
    () => filterItems(quickLinks, deferredQuery),
    [quickLinks, deferredQuery],
  )

  const isActive = (href: string) => isDocsNavItemActive(activePath, href)

  const linkClass = (href: string, emphasized = false) =>
    `text-sm hover:text-primary transition-colors block py-0.5 px-2 rounded-md hover:bg-muted/50 flex-1 leading-snug ${
      isActive(href)
        ? 'text-primary font-medium bg-primary/5'
        : emphasized
          ? 'text-foreground font-medium'
          : 'text-muted-foreground'
    }`

  const sectionTitleClass = (href: string) =>
    `font-semibold text-xs uppercase tracking-wider hover:text-primary transition-colors ${
      isActive(href) ? 'text-primary' : 'text-muted-foreground'
    }`

  const hasResults =
    filteredPinned.length > 0 || filteredSections.length > 0 || filteredQuick.length > 0

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <DocsAudienceSelector />

      <div
        className={`space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1 transition-opacity ${
          isSearchStale ? 'opacity-70' : 'opacity-100'
        }`}
        aria-busy={isSearchStale}
      >
        {!hasResults && query.trim() ? (
          <p className="text-sm text-muted-foreground px-2 py-4">No pages match &ldquo;{query.trim()}&rdquo;</p>
        ) : null}

        {filteredPinned.length > 0 && (
          <div className="space-y-0.5 pl-1 pb-2 border-b border-border/60">
            {filteredPinned.map((item) => (
              <div key={item.href} className="flex items-center gap-2">
                <div
                  className={`w-1 h-2 rounded-full shrink-0 ${
                    isActive(item.href) ? 'bg-primary' : 'bg-primary/50'
                  }`}
                />
                <Link href={item.href as DocsLinkHref} className={linkClass(item.href, true)}>
                  {item.label}
                </Link>
              </div>
            ))}
          </div>
        )}

        {filteredSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <div
                className={`w-1 h-3 rounded-full shrink-0 ${
                  isActive(section.href) ? 'bg-primary' : 'bg-primary/70'
                }`}
              />
              <Link
                href={section.href as DocsLinkHref}
                className={sectionTitleClass(section.href)}
              >
                {section.title}
              </Link>
            </div>
            {section.items.length > 0 && (
              <div className="space-y-0.5 pl-1">
                {section.items.map((item) => (
                  <div key={item.href} className="flex items-center gap-2">
                    <div
                      className={`w-1 h-2 rounded-full shrink-0 ${
                        isActive(item.href) ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}
                    />
                    <Link href={item.href as DocsLinkHref} className={linkClass(item.href)}>
                      {item.label}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredQuick.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-primary" />
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              {quickLinksTitle}
            </h4>
          </div>
          <div className="space-y-2">
            {filteredQuick.map((item) => (
              <div key={item.href + item.label} className="flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href as DocsLinkHref}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
