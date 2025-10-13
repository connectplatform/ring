'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DocsSidebarProps {
  locale: string
}

export function DocsSidebar({ locale }: DocsSidebarProps) {
  const t = useTranslations('navigation')

  const navSections = [
    {
      title: t('docs.sidebar.gettingStarted'),
      items: [
        {
          href: `/${locale}/docs/getting-started/installation`,
          label: t('docs.sidebar.installation')
        },
        {
          href: `/${locale}/docs/getting-started/prerequisites`,
          label: t('docs.sidebar.prerequisites')
        },
        {
          href: `/${locale}/docs/getting-started/first-success`,
          label: t('docs.sidebar.firstSuccess')
        },
        {
          href: `/${locale}/docs/getting-started/next-steps`,
          label: t('docs.sidebar.nextSteps')
        },
      ]
    },
    {
      title: t('docs.sidebar.features'),
      items: [
        {
          href: `/${locale}/docs/features/authentication`,
          label: t('docs.sidebar.authentication')
        },
        {
          href: `/${locale}/docs/features/entities`,
          label: t('docs.sidebar.entities')
        },
        {
          href: `/${locale}/docs/features/opportunities`,
          label: t('docs.sidebar.opportunities')
        },
        {
          href: `/${locale}/docs/features/messaging`,
          label: t('docs.sidebar.messaging')
        },
      ]
    },
    {
      title: t('docs.sidebar.apiReference'),
      items: [
        {
          href: `/${locale}/docs/api/authentication`,
          label: t('docs.sidebar.authentication')
        },
        {
          href: `/${locale}/docs/api/admin`,
          label: t('docs.sidebar.admin')
        },
        {
          href: `/${locale}/docs/api/entities`,
          label: t('docs.sidebar.entities')
        },
        {
          href: `/${locale}/docs/api/opportunities`,
          label: t('docs.sidebar.opportunities')
        },
      ]
    },
    {
      title: t('docs.sidebar.architecture'),
      items: [
        {
          href: `/${locale}/docs/architecture/data-model`,
          label: t('docs.sidebar.dataModel')
        },
        {
          href: `/${locale}/docs/architecture/security`,
          label: t('docs.sidebar.security')
        },
        {
          href: `/${locale}/docs/architecture/real-time`,
          label: t('docs.sidebar.realTime')
        },
      ]
    },
    {
      title: t('docs.sidebar.deployment'),
      items: [
        {
          href: `/${locale}/docs/deployment/docker`,
          label: t('docs.sidebar.docker')
        },
        {
          href: `/${locale}/docs/deployment/vercel`,
          label: t('docs.sidebar.vercel')
        },
        {
          href: `/${locale}/docs/deployment/environment`,
          label: t('docs.sidebar.environment')
        },
      ]
    },
    {
      title: t('docs.sidebar.examples'),
      items: [
        {
          href: `/${locale}/docs/examples/quick-start`,
          label: t('docs.sidebar.quickStart')
        },
        {
          href: `/${locale}/docs/examples/basic-setup`,
          label: t('docs.sidebar.basicSetup')
        },
        {
          href: `/${locale}/docs/examples/authentication`,
          label: t('docs.sidebar.authentication')
        },
        {
          href: `/${locale}/docs/examples/api-integration`,
          label: t('docs.sidebar.apiIntegration')
        },
      ]
    }
  ]

  return (
    <>
      <aside className="w-64 bg-card border-r border-border min-h-screen sticky top-0 overflow-y-auto hidden lg:block">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏺️</span>
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Documentation
            </span>
          </div>
        </div>

        <nav className="p-4">
          <div className="space-y-2">
            {navSections.map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-sm hover:text-primary transition-colors block py-1"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-border mt-8">
          <div className="text-xs text-muted-foreground">
            <div className="flex gap-4 flex-wrap mb-3">
              <a href="https://github.com/connectplatform/ring" className="hover:text-foreground transition-colors">GitHub</a>
              <a href="https://discord.gg/ring-platform" className="hover:text-foreground transition-colors">Discord</a>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span>© 2025 Ring Platform</span>
              <span className="text-primary">v1.0.0</span>
            </div>
            <div className="pt-2 border-t border-border">
              With ❤️ from Cherkasy
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="sm" className="bg-background/80 backdrop-blur-sm">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </>
  )
}
