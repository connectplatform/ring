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
          href: `/${locale}/docs/getting-started/index`,
          label: t('overview')
        },
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
        {
          href: `/${locale}/docs/getting-started/troubleshooting`,
          label: t('troubleshooting')
        },
      ]
    },
    {
      title: t('architecture'),
      items: [
        {
          href: `/${locale}/docs/architecture/index`,
          label: t('architectureOverview')
        },
        {
          href: `/${locale}/docs/architecture/authentication`,
          label: t('authArchitecture')
        },
        {
          href: `/${locale}/docs/architecture/data-model`,
          label: t('dataModel')
        },
        {
          href: `/${locale}/docs/architecture/real-time`,
          label: t('realTime')
        },
        {
          href: `/${locale}/docs/architecture/security`,
          label: t('security')
        },
      ]
    },
    {
      title: t('features'),
      items: [
        {
          href: `/${locale}/docs/features/index`,
          label: t('platformFeatures')
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
          label: t('multiVendorStore')
        },
        {
          href: `/${locale}/docs/features/wallet`,
          label: t('web3Wallet')
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
          label: t('nftMarketplace')
        },
        {
          href: `/${locale}/docs/features/payments`,
          label: t('paymentIntegration')
        },
        {
          href: `/${locale}/docs/features/security`,
          label: t('securityCompliance')
        },
        {
          href: `/${locale}/docs/features/staking`,
          label: t('tokenStaking')
        },
        {
          href: `/${locale}/docs/features/performance`,
          label: t('performance')
        },
      ]
    },
    {
      title: t('apiReference'),
      items: [
        {
          href: `/${locale}/docs/api/index`,
          label: t('apiOverview')
        },
        {
          href: `/${locale}/docs/api/authentication`,
          label: t('authApi')
        },
        {
          href: `/${locale}/docs/api/entities`,
          label: t('entitiesApi')
        },
        {
          href: `/${locale}/docs/api/opportunities`,
          label: t('opportunitiesApi')
        },
        {
          href: `/${locale}/docs/api/store`,
          label: t('storeApi')
        },
        {
          href: `/${locale}/docs/api/wallet`,
          label: t('walletApi')
        },
        {
          href: `/${locale}/docs/api/messaging`,
          label: t('messagingApi')
        },
        {
          href: `/${locale}/docs/api/notifications`,
          label: t('notificationsApi')
        },
        {
          href: `/${locale}/docs/api/admin`,
          label: t('adminApi')
        },
      ]
    },
    {
      title: t('cliTool'),
      items: [
        {
          href: `/${locale}/docs/cli/index`,
          label: t('ringCli')
        },
      ]
    },
    {
      title: t('customization'),
      items: [
        {
          href: `/${locale}/docs/customization/index`,
          label: t('customizationOverview')
        },
        {
          href: `/${locale}/docs/customization/branding`,
          label: t('branding')
        },
        {
          href: `/${locale}/docs/customization/themes`,
          label: t('themes')
        },
        {
          href: `/${locale}/docs/customization/components`,
          label: t('components')
        },
        {
          href: `/${locale}/docs/customization/features`,
          label: t('features')
        },
        {
          href: `/${locale}/docs/customization/localization`,
          label: t('localization')
        },
      ]
    },
    {
      title: t('deployment'),
      items: [
        {
          href: `/${locale}/docs/deployment/index`,
          label: t('deploymentOverview')
        },
        {
          href: `/${locale}/docs/deployment/docker`,
          label: t('docker')
        },
        {
          href: `/${locale}/docs/deployment/vercel`,
          label: t('vercel')
        },
        {
          href: `/${locale}/docs/deployment/environment`,
          label: t('environment')
        },
        {
          href: `/${locale}/docs/deployment/monitoring`,
          label: t('monitoring')
        },
        {
          href: `/${locale}/docs/deployment/performance`,
          label: t('performance')
        },
        {
          href: `/${locale}/docs/deployment/backup`,
          label: t('backup')
        },
      ]
    },
    {
      title: t('development'),
      items: [
        {
          href: `/${locale}/docs/development/index`,
          label: t('developmentGuide')
        },
        {
          href: `/${locale}/docs/development/local-setup`,
          label: t('localSetup')
        },
        {
          href: `/${locale}/docs/development/code-structure`,
          label: t('codeStructure')
        },
        {
          href: `/${locale}/docs/development/code-style`,
          label: t('codeStyle')
        },
        {
          href: `/${locale}/docs/development/best-practices`,
          label: t('bestPractices')
        },
        {
          href: `/${locale}/docs/development/testing`,
          label: t('testing')
        },
        {
          href: `/${locale}/docs/development/debugging`,
          label: t('debugging')
        },
        {
          href: `/${locale}/docs/development/performance`,
          label: t('performance')
        },
        {
          href: `/${locale}/docs/development/deployment`,
          label: t('devDeployment')
        },
        {
          href: `/${locale}/docs/development/workflow`,
          label: t('workflow')
        },
        {
          href: `/${locale}/docs/development/contributing`,
          label: t('contributing')
        },
      ]
    },
    {
      title: t('examples'),
      items: [
        {
          href: `/${locale}/docs/examples/index`,
          label: t('examplesOverview')
        },
        {
          href: `/${locale}/docs/examples/quick-start`,
          label: t('quickStart')
        },
        {
          href: `/${locale}/docs/examples/basic-setup`,
          label: t('basicSetup')
        },
        {
          href: `/${locale}/docs/examples/authentication`,
          label: t('authentication')
        },
        {
          href: `/${locale}/docs/examples/api-integration`,
          label: t('apiIntegration')
        },
        {
          href: `/${locale}/docs/examples/api-examples`,
          label: t('apiExamples')
        },
        {
          href: `/${locale}/docs/examples/custom-branding`,
          label: t('customBranding')
        },
        {
          href: `/${locale}/docs/examples/white-label`,
          label: t('whiteLabel')
        },
        {
          href: `/${locale}/docs/examples/multi-tenant`,
          label: t('multiTenant')
        },
        {
          href: `/${locale}/docs/examples/web3-integration`,
          label: t('web3Integration')
        },
        {
          href: `/${locale}/docs/examples/apple-signin-integration`,
          label: t('appleSignin')
        },
        {
          href: `/${locale}/docs/examples/integrations`,
          label: t('integrations')
        },
        {
          href: `/${locale}/docs/examples/advanced-features`,
          label: t('advancedFeatures')
        },
        {
          href: `/${locale}/docs/examples/real-world`,
          label: t('realWorld')
        },
      ]
    },
    {
      title: t('whiteLabel'),
      items: [
        {
          href: `/${locale}/docs/white-label/index`,
          label: t('whiteLabelOverview')
        },
        {
          href: `/${locale}/docs/white-label/quick-start`,
          label: t('quickStart')
        },
        {
          href: `/${locale}/docs/white-label/customization-guide`,
          label: t('customizationGuide')
        },
        {
          href: `/${locale}/docs/white-label/database-selection`,
          label: t('databaseSelection')
        },
        {
          href: `/${locale}/docs/white-label/payment-integration`,
          label: t('paymentIntegration')
        },
        {
          href: `/${locale}/docs/white-label/token-economics`,
          label: t('tokenEconomics')
        },
        {
          href: `/${locale}/docs/white-label/multi-tenant`,
          label: t('multiTenantSetup')
        },
        {
          href: `/${locale}/docs/white-label/ai-customization`,
          label: t('aiCustomization')
        },
        {
          href: `/${locale}/docs/white-label/success-stories`,
          label: t('successStories')
        },
      ]
    }
  ]

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="space-y-6">
      {navSections.map((section, sectionIndex) => (
        <div key={section.title} className="space-y-2">
          {/* Section Header */}
          <div className="flex items-center gap-2">
            <div className={`w-1 h-4 rounded-full ${
              sectionIndex === 0 ? 'bg-blue-500 dark:bg-blue-400' :
              sectionIndex === 1 ? 'bg-purple-500 dark:bg-purple-400' :
              sectionIndex === 2 ? 'bg-green-500 dark:bg-green-400' :
              sectionIndex === 3 ? 'bg-orange-500 dark:bg-orange-400' :
              sectionIndex === 4 ? 'bg-red-500 dark:bg-red-400' :
              sectionIndex === 5 ? 'bg-indigo-500 dark:bg-indigo-400' :
              sectionIndex === 6 ? 'bg-yellow-500 dark:bg-yellow-400' :
              sectionIndex === 7 ? 'bg-pink-500 dark:bg-pink-400' :
              sectionIndex === 8 ? 'bg-teal-500 dark:bg-teal-400' :
              'bg-gray-500 dark:bg-gray-400'
            }`} />
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h3>
          </div>

          {/* Section Items */}
          <div className="ml-3 space-y-1">
            {section.items.map((item, itemIndex) => (
              <div key={item.href} className="flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
                <Link
                  href={item.href}
                  className={`text-sm hover:text-primary transition-colors block py-1 px-2 rounded-md hover:bg-muted/50 ${
                    isActive(item.href) ? 'text-primary font-medium bg-primary/5' : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Quick Links */}
      <div className="pt-6 border-t border-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-cyan-500 dark:bg-cyan-400" />
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            Quick Links
          </h4>
        </div>
        <div className="ml-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/api`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              API Reference
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/examples`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              Code Examples
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/changelog`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              Changelog
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-muted-foreground/30" />
            <Link
              href={`/${locale}/docs/support`}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted/50"
            >
              Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
