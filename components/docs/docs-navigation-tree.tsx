import * as fs from 'fs'
import * as path from 'path'
import { connection } from 'next/server'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/shared'
import { defaultLocale, supportedLocales } from '@/i18n/shared'
import { buildDocsLinkPath, getDocsLocaleRoot, readSectionMeta } from '@/lib/docs/docs-path'
import { buildDocsPageHref } from '@/lib/docs/docs-nav-active'
import { getDocTitleFromFile } from '@/lib/docs/docs-article'
import DocsNavigationPanel from '@/components/docs/docs-navigation-panel'
import type { DocsNavItem, DocsNavSection } from '@/lib/docs/docs-nav-types'

interface DocsNavigationTreeProps {
  locale: string
}

export default async function DocsNavigationTree({ locale }: DocsNavigationTreeProps) {
  await connection()

  const validLocale: Locale = supportedLocales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale

  const t = await getTranslations({ locale: validLocale, namespace: 'navigation' })
  const pt = (key: string) => t(`docs_sidebar.portal.${key}` as Parameters<typeof t>[0])

  const docsLocale = fs.existsSync(getDocsLocaleRoot(validLocale))
    ? validLocale
    : defaultLocale

  const docsRoot = getDocsLocaleRoot(docsLocale)

  const getTitleFromMdx = (filePath: string, fallback: string): string =>
    getDocTitleFromFile(filePath, fallback)

  const slugToLabel = (slug: string): string =>
    slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  const buildHref = buildDocsPageHref

  const sectionHasIndex = (sectionDir: string): boolean =>
    fs.existsSync(path.join(sectionDir, 'index.mdx'))

  const loadTopPinnedLinks = (): DocsNavItem[] => {
    const pinned: DocsNavItem[] = []

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

  const loadHierarchicalNavigation = (): DocsNavSection[] => {
    const sections: DocsNavSection[] = []
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

      const items: DocsNavItem[] = []
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

  const quickLinks: DocsNavItem[] = [
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

  return (
    <DocsNavigationPanel
      topPinnedLinks={topPinnedLinks}
      navSections={navSections}
      quickLinks={quickLinks}
      searchPlaceholder={t('docs_sidebar.searchPlaceholder')}
      quickLinksTitle={pt('quickLinksTitle')}
    />
  )
}
