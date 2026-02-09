import Link from 'next/link'
import { headers } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { connection } from 'next/server'

interface DocsNavigationTreeProps {
  locale: string
}

interface SectionMeta {
  title: string
  pages: string[]
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
  await connection() // Next.js 16: opt out of prerendering

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const loadNavigation = (): NavigationSection[] => {
    try {
      const docsRoot = path.join(process.cwd(), 'docs', 'content', locale, 'library')
      const articles: { href: string; label: string; exists: boolean }[] = []

      // Find all MDX files recursively
      const findMdxFiles = (dir: string, basePath: string = '') => {
        const items = fs.readdirSync(dir)

        for (const item of items) {
          const fullPath = path.join(dir, item)
          const stat = fs.statSync(fullPath)

          if (stat.isDirectory()) {
            // Skip node_modules and other unwanted directories
            if (item.startsWith('.') || item === 'node_modules') continue

            const relativePath = basePath ? `${basePath}/${item}` : item
            findMdxFiles(fullPath, relativePath)
          } else if (item.endsWith('.mdx')) {
            // Calculate the href based on the file path - using simplified /docs/[section] URLs
            let href: string
            if (basePath === '') {
              // Root level file (like index.mdx) - this shouldn't happen in our structure
              href = item === 'index.mdx'
                ? `/${locale}/docs`
                : `/${locale}/docs/${item.replace('.mdx', '')}`
            } else {
              // Section file - /docs/[section] for index.mdx, /docs/[section]/[page] for others
              href = item === 'index.mdx'
                ? `/${locale}/docs/${basePath}`
                : `/${locale}/docs/${basePath}/${item.replace('.mdx', '')}`
            }

            // Get title from frontmatter or generate from filename
            const title = item === 'index.mdx' && basePath
              ? getSectionTitle(basePath, locale)
              : getPageTitleFromFile(fullPath, basePath, item.replace('.mdx', ''), locale)

            articles.push({
              href,
              label: title,
              exists: true
            })
          }
        }
      }

      findMdxFiles(docsRoot)

      // Sort articles alphabetically by label
      articles.sort((a, b) => a.label.localeCompare(b.label))

      // Return as a single section
      return [{
        title: '📚 GreenFood.live Documentation',
        items: articles
      }]

    } catch (error) {
      console.error('Failed to load unified navigation:', error)
      return [{
        title: 'Documentation',
        items: [{
          href: `/${locale}/docs/library`,
          label: 'Library',
          exists: true
        }]
      }]
    }
  }

  // Helper function to get section title from meta.json
  const getSectionTitle = (sectionSlug: string, locale: string): string => {
    try {
      const metaPath = path.join(process.cwd(), 'docs', 'content', locale, 'library', sectionSlug, 'meta.json')
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

    // Fallback: convert slug to title case
    return sectionSlug.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Helper function to get page title from file
  const getPageTitleFromFile = (filePath: string, sectionSlug: string, pageSlug: string, locale: string): string => {
    // Try to read the frontmatter from the MDX file to get title
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(content)
        if (data.title) {
          return data.title
        }
      }
    } catch (error) {
      console.warn(`Failed to read title from ${filePath}:`, error)
    }

    // Fallback: convert slug to title case
    return pageSlug === 'index'
      ? 'Overview'
      : pageSlug.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
  }

  const navSections = loadNavigation()

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="space-y-4">
      {/* Unified Documentation Section */}
      <div className="space-y-3">
        {/* Single Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="w-1 h-4 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            📚 Documentation
          </h3>
        </div>

        {/* All Articles in Single List */}
        <div className="space-y-1">
          {navSections[0]?.items.map((item, index) => (
            <div key={item.href} className="flex items-center gap-2">
              <div className={`w-1 h-3 rounded-full ${
                isActive(item.href)
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-muted-foreground/30'
              }`} />
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

      {/* Quick Links */}
      <div className="pt-4 border-t border-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-emerald-600 dark:bg-emerald-500" />
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            🌾 Quick Access
          </h4>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              📖 Welcome to GreenFood.live
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/for-farmers`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              👨‍🌾 Complete Farmer Guide
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/for-buyers`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              🛒 Complete Buyer Guide
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/token-economy`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              💰 DAAR/DAARION Token System
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
