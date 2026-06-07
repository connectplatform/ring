import Link from 'next/link'
import { headers } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { defaultLocale, supportedLocales } from '@/i18n/shared'

interface DocsNavigationTreeProps {
  locale: string
}

interface NavItem {
  href: string
  label: string
}

interface NavigationSection {
  title: string
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

  const docsLocale = fs.existsSync(
    path.join(process.cwd(), 'docs', 'content', validLocale, 'library'),
  )
    ? validLocale
    : defaultLocale

  const libraryRoot = path.join(process.cwd(), 'docs', 'content', docsLocale, 'library')

  const readMeta = (metaPath: string): { title?: string; pages?: string[] } => {
    try {
      if (!fs.existsSync(metaPath)) return {}
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch {
      return {}
    }
  }

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
      if (pageSlug === 'index') return `/${validLocale}/docs`
      return `/${validLocale}/docs/${pageSlug}`
    }
    if (pageSlug === 'index') return `/${validLocale}/docs/${sectionSlug}`
    return `/${validLocale}/docs/${sectionSlug}/${pageSlug}`
  }

  const loadHierarchicalNavigation = (): NavigationSection[] => {
    const sections: NavigationSection[] = []
    const rootMeta = readMeta(path.join(libraryRoot, 'meta.json'))
    const sectionSlugs = rootMeta.pages ?? []

    for (const entry of sectionSlugs) {
      if (entry === 'index') {
        const indexPath = path.join(libraryRoot, 'index.mdx')
        if (fs.existsSync(indexPath)) {
          sections.push({
            title: pt('linkLibrary'),
            items: [
              {
                href: buildHref(null, 'index'),
                label: getTitleFromMdx(indexPath, 'Overview'),
              },
            ],
          })
        }
        continue
      }

      if (entry === 'welcome') {
        const welcomePath = path.join(libraryRoot, 'welcome.mdx')
        if (fs.existsSync(welcomePath)) {
          sections.push({
            title: pt('linkWelcome'),
            items: [
              {
                href: buildHref(null, 'welcome'),
                label: getTitleFromMdx(welcomePath, 'Welcome'),
              },
            ],
          })
        }
        continue
      }

      const sectionDir = path.join(libraryRoot, entry)
      if (!fs.existsSync(sectionDir) || !fs.statSync(sectionDir).isDirectory()) {
        continue
      }

      const sectionMeta = readMeta(path.join(sectionDir, 'meta.json'))
      const sectionTitle = sectionMeta.title ?? slugToLabel(entry)
      const pageSlugs = sectionMeta.pages ?? ['index']

      const items: NavItem[] = []
      for (const pageSlug of pageSlugs) {
        const fileName = pageSlug === 'index' ? 'index.mdx' : `${pageSlug}.mdx`
        const filePath = path.join(sectionDir, fileName)
        if (!fs.existsSync(filePath)) continue

        items.push({
          href: buildHref(entry, pageSlug),
          label: getTitleFromMdx(filePath, pageSlug === 'index' ? sectionTitle : slugToLabel(pageSlug)),
        })
      }

      if (items.length > 0) {
        sections.push({ title: sectionTitle, items })
      }
    }

    return sections
  }

  const navSections = loadHierarchicalNavigation()

  const quickLinks: { href: string; label: string; external?: boolean }[] = [
    { href: `/${validLocale}/docs`, label: pt('linkLibrary') },
    { href: `/${validLocale}/docs/welcome`, label: pt('linkWelcome') },
    { href: `/${validLocale}/docs/getting-started`, label: pt('linkGettingStarted') },
    { href: `/${validLocale}/docs/architecture`, label: pt('linkArchitecture') },
    { href: `/${validLocale}/docs/architecture/backend-modes-and-databases`, label: pt('linkBackendModes') },
    { href: `/${validLocale}/docs/deployment/self-hosted`, label: 'Self-hosted' },
    { href: `/${validLocale}/docs/development/ring-mcp`, label: 'Ring MCP' },
    { href: `/${validLocale}/docs/deployment`, label: pt('linkDeployment') },
    { href: `/${validLocale}/docs/features/security`, label: pt('linkSecurity') },
    { href: 'https://ringdom.org', label: pt('linkRingdom'), external: true },
    { href: 'https://github.com/connectplatform/ring', label: pt('linkGithub'), external: true },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="space-y-4">
      <div className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <div className="w-1 h-3 rounded-full bg-primary/70" />
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
            </div>
            <div className="space-y-0.5 pl-1">
              {section.items.map((item) => (
                <div key={item.href} className="flex items-center gap-2">
                  <div
                    className={`w-1 h-2 rounded-full shrink-0 ${
                      isActive(item.href) ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`}
                  />
                  <Link
                    href={item.href}
                    className={`text-sm hover:text-primary transition-colors block py-0.5 px-2 rounded-md hover:bg-muted/50 flex-1 leading-snug ${
                      isActive(item.href)
                        ? 'text-primary font-medium bg-primary/5'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                </div>
              ))}
            </div>
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
                  href={item.href}
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
