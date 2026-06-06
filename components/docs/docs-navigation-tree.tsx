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

interface NavigationSection {
  title: string
  items: {
    href: string
    label: string
    exists: boolean
  }[]
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

  const loadNavigation = (): NavigationSection[] => {
    try {
      const docsRoot = path.join(process.cwd(), 'docs', 'content', docsLocale, 'library')
      const articles: { href: string; label: string; exists: boolean }[] = []

      const findMdxFiles = (dir: string, basePath: string = '') => {
        const items = fs.readdirSync(dir)

        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stat = fs.statSync(fullPath)

          if (stat.isDirectory()) {
            if (item.startsWith('.') || item === 'node_modules') continue

            const relativePath = basePath ? `${basePath}/${item}` : item
            findMdxFiles(fullPath, relativePath)
          } else if (item.endsWith('.mdx')) {
            let href: string
            if (basePath === '') {
              href =
                item === 'index.mdx'
                  ? `/${validLocale}/docs`
                  : `/${validLocale}/docs/${item.replace('.mdx', '')}`
            } else {
              href =
                item === 'index.mdx'
                  ? `/${validLocale}/docs/${basePath}`
                  : `/${validLocale}/docs/${basePath}/${item.replace('.mdx', '')}`
            }

            const title =
              item === 'index.mdx' && basePath
                ? getSectionTitle(basePath, docsLocale)
                : getPageTitleFromFile(fullPath, basePath, item.replace('.mdx', ''), docsLocale)

            articles.push({
              href,
              label: title,
              exists: true,
            })
          }
        }
      }

      findMdxFiles(docsRoot)
      articles.sort((a, b) => a.label.localeCompare(b.label))

      return [
        {
          title: pt('treeSectionTitle'),
          items: articles,
        },
      ]
    } catch (error) {
      console.error('Failed to load unified navigation:', error)
      return [
        {
          title: pt('treeSectionTitle'),
          items: [
            {
              href: `/${validLocale}/docs`,
              label: pt('linkLibrary'),
              exists: true,
            },
          ],
        },
      ]
    }
  }

  const getSectionTitle = (sectionSlug: string, loc: string): string => {
    try {
      const metaPath = path.join(process.cwd(), 'docs', 'content', loc, 'library', sectionSlug, 'meta.json')
      if (fs.existsSync(metaPath)) {
        const metaContent = fs.readFileSync(metaPath, 'utf8')
        const meta = JSON.parse(metaContent)
        if (meta.title) {
          return meta.title
        }
      }
    } catch (error) {
      console.warn(`Failed to read section title from ${sectionSlug}:`, error)
    }

    return sectionSlug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getPageTitleFromFile = (
    filePath: string,
    sectionSlug: string,
    pageSlug: string,
    loc: string,
  ): string => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(content)
        if (data.title) return data.title
      }
    } catch (error) {
      console.warn(`Failed to read title from ${filePath}:`, error)
    }

    return pageSlug === 'index'
      ? 'Overview'
      : pageSlug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
  }

  const navSections = loadNavigation()

  const quickLinks: { href: string; label: string; external?: boolean }[] = [
    { href: `/${validLocale}/docs`, label: pt('linkLibrary') },
    { href: `/${validLocale}/docs/welcome`, label: pt('linkWelcome') },
    { href: `/${validLocale}/docs/getting-started`, label: pt('linkGettingStarted') },
    { href: `/${validLocale}/docs/architecture`, label: pt('linkArchitecture') },
    { href: `/${validLocale}/docs/architecture/backend-modes-and-databases`, label: pt('linkBackendModes') },
    { href: `/${validLocale}/docs/deployment`, label: pt('linkDeployment') },
    { href: `/${validLocale}/docs/white-label`, label: pt('linkWhiteLabel') },
    { href: `/${validLocale}/docs/white-label/token-economics`, label: pt('linkTokenEconomy') },
    { href: `/${validLocale}/docs/features/security`, label: pt('linkSecurity') },
    { href: 'https://ringdom.org', label: pt('linkRingdom'), external: true },
    { href: 'https://github.com/connectplatform/ring', label: pt('linkGithub'), external: true },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="w-1 h-4 rounded-full bg-primary" />
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            {pt('treeSectionTitle')}
          </h3>
        </div>

        <div className="space-y-1">
          {navSections[0]?.items.map((item) => (
            <div key={item.href} className="flex items-center gap-2">
              <div
                className={`w-1 h-3 rounded-full ${
                  isActive(item.href) ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
              <Link
                href={item.href}
                className={`text-sm hover:text-primary transition-colors block py-1 px-2 rounded-md hover:bg-muted/50 flex-1 ${
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
