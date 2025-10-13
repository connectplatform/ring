'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface DocsNavigationTreeProps {
  locale: string
}

export default function DocsNavigationTree({ locale }: DocsNavigationTreeProps) {
  const pathname = usePathname()
  const t = useTranslations('navigation.docs_sidebar.sidebar')

  const navSections = [
    {
      title: t('gettingStarted'),
      items: [
        {
          href: `/${locale}/docs/getting-started/installation`,
          label: t('installation')
        },
        {
          href: `/${locale}/docs/getting-started/prerequisites`,
          label: t('prerequisites')
        },
        {
          href: `/${locale}/docs/getting-started/first-success`,
          label: t('firstSuccess')
        },
        {
          href: `/${locale}/docs/getting-started/next-steps`,
          label: t('nextSteps')
        },
      ]
    },
    {
      title: t('features'),
      items: [
        {
          href: `/${locale}/docs/features/index`,
          label: 'Platform Features'
        },
        {
          href: `/${locale}/docs/features/authentication`,
          label: t('authentication')
        },
        {
          href: `/${locale}/docs/features/entities`,
          label: t('entities')
        },
        {
          href: `/${locale}/docs/features/opportunities`,
          label: t('opportunities')
        },
        {
          href: `/${locale}/docs/features/store`,
          label: 'Multi-Vendor Store'
        },
        {
          href: `/${locale}/docs/features/wallet`,
          label: 'Web3 Wallet'
        },
        {
          href: `/${locale}/docs/features/messaging`,
          label: t('messaging')
        },
        {
          href: `/${locale}/docs/features/notifications`,
          label: t('notifications')
        },
        {
          href: `/${locale}/docs/features/nft-market`,
          label: 'NFT Marketplace'
        },
        {
          href: `/${locale}/docs/features/payments`,
          label: 'Payment Integration'
        },
        {
          href: `/${locale}/docs/features/security`,
          label: 'Security & Compliance'
        },
        {
          href: `/${locale}/docs/features/staking`,
          label: 'Token Staking System'
        },
        {
          href: `/${locale}/docs/features/performance`,
          label: 'Performance Optimization'
        },
      ]
    },
    {
      title: 'API Reference',
      items: [
        {
          href: `/${locale}/docs/api/index`,
          label: 'API Overview'
        },
        {
          href: `/${locale}/docs/api/authentication`,
          label: 'Authentication'
        },
        {
          href: `/${locale}/docs/api/entities`,
          label: 'Entities API'
        },
        {
          href: `/${locale}/docs/api/opportunities`,
          label: 'Opportunities API'
        },
        {
          href: `/${locale}/docs/api/store`,
          label: 'Store API'
        },
        {
          href: `/${locale}/docs/api/wallet`,
          label: 'Wallet API'
        },
        {
          href: `/${locale}/docs/api/messaging`,
          label: 'Messaging API'
        },
        {
          href: `/${locale}/docs/api/notifications`,
          label: 'Notifications API'
        },
        {
          href: `/${locale}/docs/api/admin`,
          label: 'Admin API'
        },
      ]
    },
    {
      title: 'Deployment',
      items: [
        {
          href: `/${locale}/docs/deployment/index`,
          label: 'Deployment Overview'
        },
        {
          href: `/${locale}/docs/deployment/docker`,
          label: 'Docker'
        },
        {
          href: `/${locale}/docs/deployment/kubernetes`,
          label: 'Kubernetes'
        },
        {
          href: `/${locale}/docs/deployment/vercel`,
          label: 'Vercel'
        },
        {
          href: `/${locale}/docs/deployment/environment`,
          label: 'Environment Setup'
        },
        {
          href: `/${locale}/docs/deployment/monitoring`,
          label: 'Monitoring'
        },
        {
          href: `/${locale}/docs/deployment/performance`,
          label: 'Performance'
        },
        {
          href: `/${locale}/docs/deployment/backup`,
          label: 'Backup'
        },
      ]
    }
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="space-y-4">
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
                  className={`text-sm hover:text-primary transition-colors block py-1 ${
                    isActive(item.href) ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Quick Links */}
      <div className="pt-4 border-t border-border space-y-2">
        <h4 className="font-medium text-sm">Quick Links</h4>
        <div className="space-y-1">
          <Link
            href={`/${locale}/docs/api`}
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            API Reference
          </Link>
          <Link
            href={`/${locale}/docs/examples`}
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Code Examples
          </Link>
          <Link
            href={`/${locale}/docs/changelog`}
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Changelog
          </Link>
          <Link
            href={`/${locale}/docs/support`}
            className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </Link>
        </div>
      </div>
    </div>
  )
}
