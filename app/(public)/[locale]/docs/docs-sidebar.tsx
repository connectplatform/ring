'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DocsSidebarProps {
  locale: string
}

interface NavItem {
  href: string
  label: string
  external?: boolean
}

/** Legacy / alternate docs chrome — Ring Platform portal (not GreenFood). */
export function DocsSidebar({ locale }: DocsSidebarProps) {
  const t = useTranslations('navigation')
  const pt = (key: string) => t(`docs_sidebar.portal.${key}` as Parameters<typeof t>[0])
  const s = (key: string) => t(`docs_sidebar.sidebar.${key}` as Parameters<typeof t>[0])

  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: '📘 ' + pt('sectionLibrary'),
      items: [
        { href: `/${locale}/docs`, label: pt('linkLibrary') },
        { href: `/${locale}/docs/welcome`, label: pt('linkWelcome') },
      ],
    },
    {
      title: '🔷 ' + pt('sectionRingdom'),
      items: [
        {
          href: 'https://ringdom.org',
          label: pt('linkRingdom'),
          external: true,
        },
        {
          href: `/${locale}/docs/white-label/ai-customization`,
          label: s('aiCustomization'),
        },
        {
          href: `/${locale}/docs/examples`,
          label: s('examplesOverview'),
        },
      ],
    },
    {
      title: '🚀 ' + pt('sectionGettingStarted'),
      items: [
        { href: `/${locale}/docs/getting-started`, label: s('overview') },
        { href: `/${locale}/docs/getting-started/prerequisites`, label: s('prerequisites') },
        { href: `/${locale}/docs/getting-started/installation`, label: s('installation') },
        { href: `/${locale}/docs/getting-started/first-success`, label: s('firstSuccess') },
        { href: `/${locale}/docs/getting-started/next-steps`, label: s('nextSteps') },
      ],
    },
    {
      title: '🧱 ' + pt('sectionArchitecture'),
      items: [
        { href: `/${locale}/docs/architecture`, label: s('architectureOverview') },
        { href: `/${locale}/docs/architecture/backend-modes-and-databases`, label: s('backendModesAndDatabases') },
        { href: `/${locale}/docs/architecture/authentication`, label: s('authArchitecture') },
        { href: `/${locale}/docs/features`, label: s('platformFeatures') },
        { href: `/${locale}/docs/features/security`, label: s('security') },
      ],
    },
    {
      title: '☸️ ' + pt('sectionDeploy'),
      items: [
        { href: `/${locale}/docs/deployment`, label: s('deploymentOverview') },
        { href: `/${locale}/docs/deployment/docker`, label: s('docker') },
        { href: `/${locale}/docs/deployment/performance`, label: s('performance') },
      ],
    },
    {
      title: '🏷️ ' + pt('sectionWhiteLabel'),
      items: [
        { href: `/${locale}/docs/customization`, label: s('customizationOverview') },
        { href: `/${locale}/docs/customization/customization-guide`, label: s('customizationGuide') },
        { href: `/${locale}/docs/customization/database-selection`, label: s('databaseSelection') },
        { href: `/${locale}/docs/customization/token-economics`, label: s('tokenEconomics') },
      ],
    },
    {
      title: '🔌 ' + pt('sectionApi'),
      items: [
        { href: `/${locale}/docs/api`, label: s('apiOverview') },
        { href: `/${locale}/docs/api/entities`, label: s('entitiesApi') },
        { href: `/${locale}/docs/integrations/ethereum-wallets`, label: s('web3Integration') },
      ],
    },
    {
      title: '🧪 ' + pt('sectionDev'),
      items: [
        { href: `/${locale}/docs/development`, label: s('developmentGuide') },
        { href: `/${locale}/docs/examples`, label: s('examplesOverview') },
        { href: `/${locale}/docs/cli`, label: s('ringCli') },
      ],
    },
    {
      title: '🛡️ ' + pt('sectionAudit'),
      items: [
        { href: `/${locale}/docs/features/security`, label: s('securityCompliance') },
        { href: `/${locale}/docs/customization/database-selection`, label: s('databaseSelection') },
        {
          href: 'https://github.com/connectplatform/ring',
          label: pt('linkGithub'),
          external: true,
        },
      ],
    },
  ]

  return (
    <>
      <aside className="w-72 bg-card border-r border-border min-h-screen sticky top-0 overflow-y-auto hidden lg:block">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              💠
            </span>
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Ring Platform
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{pt('footerMission')}</p>
        </div>

        <nav className="p-4">
          <div className="space-y-6">
            {navSections.map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.href + item.label}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:text-primary transition-colors block py-1"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="text-sm hover:text-primary transition-colors block py-1"
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-border mt-4 space-y-3 text-xs text-muted-foreground">
          <p>{pt('footerRingdomLine')}</p>
          <div className="flex gap-4 flex-wrap">
            <a
              href="https://github.com/connectplatform/ring"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://ringdom.org"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              ringdom.org
            </a>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span>{pt('footerYear')}</span>
          </div>
        </div>
      </aside>

      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </>
  )
}
