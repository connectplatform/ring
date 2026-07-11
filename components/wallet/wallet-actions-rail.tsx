'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { DavinciGlassPanel, davinciCtaPrimary } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import {
  ArrowUpRight,
  Plus,
  Shield,
  BookOpen,
  CreditCard,
  Lock,
  AlertTriangle,
  PiggyBank,
  ImageIcon,
  Users,
  Wallet,
} from 'lucide-react'

interface WalletActionsRailProps {
  locale: Locale
  onNavigate?: () => void
}

function RailSectionHeading({
  id,
  icon,
  title,
}: {
  id: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <h2 id={id} className="mb-3 flex items-center gap-2 text-lg font-semibold">
      <span className="text-[var(--davinci-beam)]">{icon}</span>
      {title}
    </h2>
  )
}

export default function WalletActionsRail({ locale, onNavigate }: WalletActionsRailProps) {
  const router = useRouter()
  const t = useTranslations('modules.wallet')

  const navigate = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  const quickActions = [
    {
      id: 'send',
      label: t('sendTokens'),
      icon: ArrowUpRight,
      variant: 'default' as const,
      onClick: () => navigate(ROUTES.WALLET_SEND(locale)),
    },
    {
      id: 'contacts',
      label: t('contacts'),
      icon: Users,
      variant: 'outline' as const,
      onClick: () => navigate(ROUTES.CONTACTS(locale)),
    },
    {
      id: 'staking',
      label: t('staking'),
      icon: PiggyBank,
      variant: 'outline' as const,
      onClick: () => navigate(ROUTES.WALLET_STAKING(locale)),
    },
    {
      id: 'nft',
      label: t('nftMarket'),
      icon: ImageIcon,
      variant: 'outline' as const,
      onClick: () => navigate(ROUTES.NFT_COLLECTIONS(locale)),
    },
  ]

  const securityTips = [
    {
      id: 'backup',
      title: t('backupPhrase'),
      icon: Shield,
      urgent: true,
      disabled: true,
      onClick: undefined as (() => void) | undefined,
    },
    {
      id: '2fa',
      title: t('enable2FA'),
      icon: Lock,
      urgent: false,
      disabled: true,
      onClick: undefined as (() => void) | undefined,
    },
    {
      id: 'phishing',
      title: t('avoidPhishing'),
      icon: AlertTriangle,
      urgent: false,
      disabled: false,
      onClick: () => navigate(`${ROUTES.DOCS(locale)}/wallet/security-tips`),
    },
  ]

  const docLinks = [
    { label: t('walletOverview'), href: `${ROUTES.DOCS(locale)}/features/wallet` },
    { label: t('paymentsAndCredits'), href: `${ROUTES.DOCS(locale)}/features/payments` },
    {
      label: t('tokenEconomics'),
      href: `${ROUTES.DOCS(locale)}/customization/token-economics`,
    },
    { label: t('securityGuide'), href: `${ROUTES.DOCS(locale)}/features/security` },
    { label: t('avoidPhishing'), href: `${ROUTES.DOCS(locale)}/wallet/security-tips` },
  ]

  return (
    <div className="flex min-h-0 flex-col space-y-6 text-foreground">
      <section aria-labelledby="wallet-sidebar-header">
        <h2
          id="wallet-sidebar-header"
          className="mb-1 flex items-center gap-2 text-lg font-semibold"
        >
          <Wallet className="h-5 w-5 shrink-0 text-[var(--davinci-beam)]" />
          {t('title')}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('description')}</p>
        <div className="space-y-2">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant}
              className="w-full justify-start rounded-xl"
              onClick={action.onClick}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
        <Separator className="mt-4" />
      </section>

      <DavinciGlassPanel
        title={t('boostYourWallet')}
        description={t('topUpDescription')}
        icon={<CreditCard className="h-3.5 w-3.5" />}
        beamDuration="5s"
      >
        <button
          type="button"
          onClick={() => navigate(ROUTES.WALLET_TOPUP(locale))}
          className={cn(davinciCtaPrimary, 'flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm')}
        >
          <Plus className="h-4 w-4 text-[var(--davinci-beam)]" aria-hidden />
          {t('topUpNow')}
        </button>
      </DavinciGlassPanel>

      <Separator />

      <DavinciGlassPanel
        title={t('securityTips')}
        icon={<Shield className="h-3.5 w-3.5" />}
        beamDuration="8s"
      >
        <ul className="space-y-3">
          {securityTips.map((tip) => (
            <li key={tip.id}>
              <button
                type="button"
                disabled={tip.disabled}
                onClick={tip.onClick}
                className="flex w-full items-start gap-3 text-left transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <div
                  className={cn(
                    'shrink-0 rounded-full p-1',
                    tip.urgent
                      ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                      : 'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)] text-[var(--davinci-beam)]',
                  )}
                >
                  <tip.icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tip.title}</p>
                  {tip.urgent && (
                    <Badge variant="destructive" className="mt-1 text-xs">
                      {t('urgent')}
                    </Badge>
                  )}
                  {tip.disabled && tip.id !== 'phishing' && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('comingSoon')}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </DavinciGlassPanel>

      <Separator />

      <section aria-labelledby="wallet-sidebar-guide">
        <RailSectionHeading
          id="wallet-sidebar-guide"
          icon={<BookOpen className="h-5 w-5 shrink-0" />}
          title={t('walletGuide')}
        />
        <p className="mb-2 text-sm text-muted-foreground">{t('guideDescription')}</p>
        <div className="flex flex-col items-start gap-1">
          {docLinks.map((link) => (
            <Button
              key={link.href}
              variant="link"
              className="h-auto p-0 text-sm text-[var(--davinci-beam)]"
              onClick={() => navigate(link.href)}
            >
              {link.label} →
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}
