'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Crown,
  ArrowRight,
  X,
  Sparkles,
  LayoutGrid,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import Link from 'next/link'
import { useRouter } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { motion } from 'framer-motion'
import { eventBus } from '@/lib/event-bus.client'
import { cn } from '@/lib/utils'
import { RingCenterPaneOverlay } from '@/components/layout/ring-center-pane-overlay'
import {
  BorderBeam,
  HeroAmbient,
  davinciAuthButtonLift,
  davinciBeamInnerSurface,
  davinciCtaPrimary,
  davinciGlassSurface,
  davinciPanelSurface,
  davinciTerminalSurface,
} from '@/lib/ui/davinci'

import {
  OPPORTUNITY_SELECTOR_TYPE_ORDER,
  opportunitySelectorTypePresets,
  type OpportunityTypeKey,
} from '@/features/opportunities/lib/opportunity-type-presets'

interface OpportunityTypeSelectorClientProps {
  userRole: 'member' | 'subscriber'
  locale?: Locale
  layout?: 'embedded' | 'overlay'
  onClose?: () => void
}

export function OpportunityTypeSelectorClient({
  onClose,
  userRole,
  layout = 'embedded',
}: OpportunityTypeSelectorClientProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const addOpportunityHref = (typeKey: string) =>
    `${ROUTES.ADD_OPPORTUNITY(locale)}?type=${encodeURIComponent(typeKey)}`

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }
    router.push(ROUTES.OPPORTUNITIES(locale) as '/opportunities')
  }

  useEffect(() => {
    if (layout !== 'overlay') return

    const unsubscribe = eventBus.on('modal:close-all', handleClose)
    eventBus.emit('modal:opened', { modalId: 'opportunity-type-selector', zIndex: 30 })

    return () => {
      unsubscribe()
      eventBus.emit('modal:closed', { modalId: 'opportunity-type-selector' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleClose stable enough for overlay lifecycle
  }, [layout])

  if (showUpgradeModal) {
    return (
      <MembershipUpgradeModal onClose={handleClose} returnTo={addOpportunityHref('offer')} />
    )
  }

  const renderTypeCard = (typeKey: OpportunityTypeKey, index: number) => {
    const config = opportunitySelectorTypePresets[typeKey]
    const Icon = config.icon
    const AccentIcon = config.accentIcon
    const canAccess = !config.requiresMembership || userRole === 'member'

    return (
      <motion.div
        key={typeKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="h-full"
      >
        <BorderBeam
          duration="6s"
          className={cn(davinciGlassSurface, davinciAuthButtonLift, 'h-full')}
          innerClassName={cn(davinciBeamInnerSurface, 'flex h-full flex-col p-5')}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <span
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
                'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
              )}
            >
              <Icon className="h-6 w-6 text-[var(--davinci-beam)]" />
            </span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {config.popular && (
                <Badge
                  variant="secondary"
                  className="border-[color-mix(in_oklch,var(--davinci-beam)_25%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] text-[10px]"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  {tCommon('labels.popular', { defaultValue: 'Popular' })}
                </Badge>
              )}
              {config.requiresMembership && userRole === 'subscriber' && (
                <Badge variant="outline" className="text-[10px]">
                  <Crown className="mr-1 h-3 w-3" />
                  {tCommon('membership.title', { defaultValue: 'Member' })}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-base font-semibold leading-tight">
                {t(`type_selector.${typeKey}.title`)}
              </h3>
              <AccentIcon className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]/60" />
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {t(`type_selector.${typeKey}.description`)}
            </p>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {config.examples.map((example) => (
                <span
                  key={example}
                  className={cn(
                    davinciTerminalSurface,
                    'inline-flex px-2 py-0.5 text-[10px] font-medium text-foreground/85',
                  )}
                >
                  {t(`type_selector.${typeKey}.examples.${example}`, { defaultValue: example })}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-2">
              {canAccess ? (
                <Button asChild className={cn('w-full', davinciCtaPrimary)}>
                  <Link href={addOpportunityHref(typeKey)}>
                    {t(`type_selector.${typeKey}.button`)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  variant="outline"
                  className="w-full border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)]"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  {t(`type_selector.${typeKey}.upgrade_button`)}
                </Button>
              )}
            </div>
          </div>
        </BorderBeam>
      </motion.div>
    )
  }

  const header = (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color-mix(in_oklch,var(--davinci-beam)_18%,transparent)] pb-5">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
            )}
          >
            <LayoutGrid className="h-5 w-5 text-[var(--davinci-beam)]" />
          </span>
          <h2 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
            {t('type_selector.title')}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t('type_selector.subtitle')}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleClose}
        className="h-10 w-10 shrink-0 rounded-full border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)]"
        aria-label={tCommon('actions.close', { defaultValue: 'Close' })}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )

  const grid = (
    <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2">
      {OPPORTUNITY_SELECTOR_TYPE_ORDER.map((typeKey, index) => renderTypeCard(typeKey, index))}
    </div>
  )

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <HeroAmbient className="pointer-events-none absolute inset-0 opacity-35" />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-8 lg:py-8">
        {header}
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain">{grid}</div>
      </div>
    </div>
  )

  if (layout === 'embedded') {
    return (
      <div
        className={cn(
          'relative flex min-h-full w-full flex-col overflow-hidden rounded-xl',
          davinciPanelSurface,
        )}
      >
        {body}
      </div>
    )
  }

  return (
    <RingCenterPaneOverlay open ariaLabel={t('type_selector.title')}>
      {body}
    </RingCenterPaneOverlay>
  )
}
