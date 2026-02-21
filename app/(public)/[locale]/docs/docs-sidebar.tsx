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
      title: '🌾 ' + t('docs_sidebar.sidebar.gettingStarted'),
      items: [
        {
          href: `/${locale}/docs/`,
          label: t('docs_sidebar.sidebar.overview')
        },
        {
          href: `/${locale}/docs/for-farmers`,
          label: 'For Farmers'
        },
        {
          href: `/${locale}/docs/for-buyers`,
          label: 'For Buyers'
        },
      ]
    },
    {
      title: '💰 ' + t('docs_sidebar.sidebar.tokenEconomics'),
      items: [
        {
          href: `/${locale}/docs/token-economy`,
          label: 'DAAR/DAARION System'
        },
        {
          href: `/${locale}/docs/token-economy/daarsales`,
          label: 'Buy DAAR Tokens'
        },
        {
          href: `/${locale}/docs/token-economy/daarionsales`,
          label: 'Buy DAARION Tokens'
        },
        {
          href: `/${locale}/docs/token-economy/staking`,
          label: 'Staking & Rewards'
        },
      ]
    },
    {
      title: '🌱 Agricultural Features',
      items: [
        {
          href: `/${locale}/docs/agricultural-features`,
          label: 'Complete Feature Set'
        },
        {
          href: `/${locale}/docs/agricultural-features/product-schema`,
          label: 'Product Schema (80+ fields)'
        },
        {
          href: `/${locale}/docs/agricultural-features/entity-types`,
          label: 'Entity Types (262 fields)'
        },
        {
          href: `/${locale}/docs/agricultural-features/certifications`,
          label: 'Certifications & Compliance'
        },
        {
          href: `/${locale}/docs/agricultural-features/sustainability`,
          label: 'Sustainability Metrics'
        },
      ]
    },
    {
      title: '🔗 Blockchain Traceability',
      items: [
        {
          href: `/${locale}/docs/traceability`,
          label: 'FSMA 204 Compliance'
        },
        {
          href: `/${locale}/docs/traceability/fsma-204`,
          label: 'FDA Requirements Guide'
        },
        {
          href: `/${locale}/docs/traceability/blockchain`,
          label: 'Blockchain Verification'
        },
        {
          href: `/${locale}/docs/traceability/smart-contracts`,
          label: 'Smart Contract Documentation'
        },
        {
          href: `/${locale}/docs/traceability/cold-chain`,
          label: 'Cold Chain Monitoring'
        },
      ]
    },
    {
      title: '🤖 AI Operations',
      items: [
        {
          href: `/${locale}/docs/dagi-agents`,
          label: 'DAGI Agent Overview'
        },
        {
          href: `/${locale}/docs/dagi-agents/tier-1`,
          label: 'Junior Agent (Tier 1)'
        },
        {
          href: `/${locale}/docs/dagi-agents/tier-2`,
          label: 'Medium Agent (Tier 2)'
        },
        {
          href: `/${locale}/docs/dagi-agents/tier-3`,
          label: 'Senior Agent (Tier 3)'
        },
      ]
    },
    {
      title: '🏛️ Cooperative Governance',
      items: [
        {
          href: `/${locale}/docs/cooperative-governance`,
          label: 'Democratic Management'
        },
        {
          href: `/${locale}/docs/cooperative-governance/voting-systems`,
          label: 'Voting Systems'
        },
        {
          href: `/${locale}/docs/cooperative-governance/proposals`,
          label: 'Creating Proposals'
        },
        {
          href: `/${locale}/docs/cooperative-governance/patronage-refunds`,
          label: 'Patronage Refunds'
        },
        {
          href: `/${locale}/docs/cooperative-governance/microdao`,
          label: 'microDAO Integration'
        },
        {
          href: `/${locale}/docs/cooperative-governance/treasury`,
          label: 'Treasury Management'
        },
      ]
    }
  ]

  return (
    <>
      <aside className="w-64 bg-card border-r border-border min-h-screen sticky top-0 overflow-y-auto hidden lg:block">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <span className="font-bold text-xl bg-gradient-to-r from-green-600 to-amber-600 bg-clip-text text-transparent">
              GreenFood.live
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t('sidebar.verifiedFarms')}
          </p>
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
