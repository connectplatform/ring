import type { ComponentProps } from 'react'
import { headers } from 'next/headers'
import { Link } from '@/i18n/routing'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { defaultLocale, supportedLocales } from '@/i18n/shared'
import { buildDocsLinkPath, getDocsLocaleRoot, readSectionMeta } from '@/lib/docs/docs-path'
import { pathnameWithoutLocale } from '@/lib/seo-metadata'

type DocsLinkHref = ComponentProps<typeof Link>['href']

interface DocsNavigationTreeProps {
  locale: string
}

interface NavItem {
  href: string
  label: string
}

interface NavigationSection {
  title: string
  href: string
  items: NavItem[]
}

export default async function DocsNavigationTree({ locale }: DocsNavigationTreeProps) {
  await connection()

  const validLocale: Locale = supportedLocales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale

  const t = await getTranslations({ locale: validLocale, namespace: 'navigation' })
  const pt = (key: string) => t(`docs_sidebar.portal.${key}` as Parameters<typeof t>[0])

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const docsLocale = fs.existsSync(getDocsLocaleRoot(validLocale))
    ? validLocale
    : defaultLocale

  const docsRoot = getDocsLocaleRoot(docsLocale)

  const getTitleFromMdx = (filePath: string, fallback: string): string => {
    try {
      if (!fs.existsSync(filePath)) return fallback
      const { data } = matter(fs.readFileSync(filePath, 'utf8'))
      if (data.title && typeof data.title === 'string') return data.title
    } catch {
      // ignore
    }
    return fallback
  }

  const slugToLabel = (slug: string): string =>
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  const buildHref = (sectionSlug: string | null, pageSlug: string): string => {
    if (sectionSlug === null) {
      if (pageSlug === 'index') return buildDocsLinkPath([])
      return buildDocsLinkPath([pageSlug])
    }
    if (pageSlug === 'index') return buildDocsLinkPath([sectionSlug])
    return buildDocsLinkPath([sectionSlug, pageSlug])
  }

  const sectionHasIndex = (sectionDir: string): boolean =>
    fs.existsSync(path.join(sectionDir, 'index.mdx'))

  const loadTopPinnedLinks = (): NavItem[] => {
    const pinned: NavItem[] = []

    const welcomePath = path.join(docsRoot, 'welcome.mdx')
    if (fs.existsSync(welcomePath)) {
      pinned.push({
        href: buildHref(null, 'welcome'),
        label: getTitleFromMdx(welcomePath, 'Welcome to Ring'),
      })
    }

    const indexPath = path.join(docsRoot, 'index.mdx')
    if (fs.existsSync(indexPath)) {
      pinned.push({
        href: buildHref(null, 'index'),
        label: pt('linkQuickReference'),
      })
    }

    return pinned
  }

  const loadHierarchicalNavigation = (): NavigationSection[] => {
    const sections: NavigationSection[] = []
    const rootMeta = readSectionMeta(path.join(docsRoot, 'meta.json'))
    const sectionSlugs = rootMeta.pages ?? []

    for (const entry of sectionSlugs) {
      if (entry === 'index' || entry === 'welcome') {
        continue
      }

      const sectionDir = path.join(docsRoot, entry)
      if (!fs.existsSync(sectionDir) || !fs.statSync(sectionDir).isDirectory()) {
        continue
      }

      const sectionMeta = readSectionMeta(path.join(sectionDir, 'meta.json'))
      const sectionTitle = sectionMeta.title ?? slugToLabel(entry)
      const pageSlugs = sectionMeta.pages ?? ['index']
      const sectionHref = sectionHasIndex(sectionDir)
        ? buildDocsLinkPath([entry])
        : buildDocsLinkPath([entry, pageSlugs.find((s) => s !== 'index') ?? 'index'])

      const items: NavItem[] = []
      for (const pageSlug of pageSlugs) {
        if (pageSlug === 'index') {
          continue
        }

        const nestedDir = path.join(sectionDir, pageSlug)
        const nestedMetaPath = path.join(nestedDir, 'meta.json')

        if (fs.existsSync(nestedDir) && fs.statSync(nestedDir).isDirectory() && fs.existsSync(nestedMetaPath)) {
          const nestedMeta = readSectionMeta(nestedMetaPath)
          const nestedPages = nestedMeta.pages ?? ['index']
          for (const nestedPageSlug of nestedPages) {
            if (nestedPageSlug === 'index') {
              continue
            }

            const nestedFileName = `${nestedPageSlug}.mdx`
            const nestedFilePath = path.join(nestedDir, nestedFileName)
            if (!fs.existsSync(nestedFilePath)) continue

            items.push({
              href: buildDocsLinkPath([entry, pageSlug, nestedPageSlug]),
              label: getTitleFromMdx(nestedFilePath, slugToLabel(nestedPageSlug)),
            })
          }
          continue
        }

        const fileName = `${pageSlug}.mdx`
        const filePath = path.join(sectionDir, fileName)
        if (!fs.existsSync(filePath)) continue

        items.push({
          href: buildHref(entry, pageSlug),
          label: getTitleFromMdx(filePath, slugToLabel(pageSlug)),
        })
      }

      sections.push({ title: sectionTitle, href: sectionHref, items })
    }

    return sections
  }

  const topPinnedLinks = loadTopPinnedLinks()
  const navSections = loadHierarchicalNavigation()

  const quickLinks: { href: string; label: string; external?: boolean }[] = [
    { href: buildDocsLinkPath(['welcome']), label: pt('linkWelcome') },
    { href: buildDocsLinkPath([]), label: pt('linkQuickReference') },
    { href: buildDocsLinkPath(['getting-started']), label: pt('linkGettingStarted') },
    { href: buildDocsLinkPath(['architecture']), label: pt('linkArchitecture') },
    { href: buildDocsLinkPath(['architecture', 'backend-modes-and-databases']), label: pt('linkBackendModes') },
    { href: buildDocsLinkPath(['deployment', 'self-hosted']), label: 'Self-hosted' },
    { href: buildDocsLinkPath(['mcp']), label: 'Ring MCP Tools' },
    { href: buildDocsLinkPath(['development', 'ring-mcp']), label: 'Ring MCP Server' },
    { href: buildDocsLinkPath(['customization', 'token-economics']), label: 'Token economics' },
    { href: buildDocsLinkPath(['web3', 'token-launch-jurisdictions']), label: 'Token launch jurisdictions' },
    { href: buildDocsLinkPath(['deployment']), label: pt('linkDeployment') },
    { href: buildDocsLinkPath(['features', 'security']), label: pt('linkSecurity') },
    { href: 'https://ringdom.org', label: pt('linkRingdom'), external: true },
    { href: 'https://github.com/connectplatform/ring', label: pt('linkGithub'), external: true },
  ]

  const pathWithoutLocale = pathnameWithoutLocale(pathname)
  const isActive = (href: string) =>
    pathWithoutLocale === href || pathWithoutLocale.startsWith(href + '/')

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

  return (
    <div className="space-y-4">
      <div className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
        {topPinnedLinks.length > 0 && (
          <div className="space-y-0.5 pl-1 pb-2 border-b border-border/60">
            {topPinnedLinks.map((item) => (
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

        {navSections.map((section) => (
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

      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-primary" />
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            {pt('quickLinksTitle')}
          </h4>
        </div>
        <div className="space-y-2">
          {quickLinks.map((item) => (
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
    </div>
  )
}
