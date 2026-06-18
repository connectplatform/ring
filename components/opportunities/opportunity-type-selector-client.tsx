'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Briefcase,
  Crown,
  ArrowRight,
  X,
  Sparkles,
  TrendingUp,
  Target,
  Zap,
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
    eventBus.emit('modal:opened', { modalId: 'opportunity-type-selector', zIndex: 8000 })

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
      <motion.article
        key={typeKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'flex h-full flex-col rounded-2xl border border-border/50',
          'bg-gradient-to-br from-primary/5 via-background to-background p-5',
          'backdrop-blur-sm transition-shadow hover:shadow-md',
          !canAccess && 'opacity-90',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/75 shadow-md">
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {config.popular && (
              <Badge variant="secondary" className="text-[10px]">
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
            <AccentIcon className="h-4 w-4 shrink-0 text-primary/50" />
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {t(`type_selector.${typeKey}.description`)}
          </p>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {config.examples.map((example) => (
              <Badge key={example} variant="outline" className="text-[10px] font-normal">
                {t(`type_selector.${typeKey}.examples.${example}`, { defaultValue: example })}
              </Badge>
            ))}
          </div>

          <div className="mt-auto pt-2">
            {canAccess ? (
              <Button asChild className="w-full shadow-sm">
                <Link href={addOpportunityHref(typeKey)}>
                  {t(`type_selector.${typeKey}.button`)}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => setShowUpgradeModal(true)} variant="outline" className="w-full">
                <Crown className="mr-2 h-4 w-4" />
                {t(`type_selector.${typeKey}.upgrade_button`)}
              </Button>
            )}
          </div>
        </div>
      </motion.article>
    )
  }

  const header = (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/40 pb-5">
      <div className="min-w-0 space-y-2">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent lg:text-2xl">
          {t('type_selector.title')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {t('type_selector.subtitle')}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleClose}
        className="h-10 w-10 shrink-0 rounded-full"
        aria-label={tCommon('actions.close', { defaultValue: 'Close' })}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )

  const grid = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 min-h-0 flex-1 content-start">
      {OPPORTUNITY_SELECTOR_TYPE_ORDER.map((typeKey, index) => renderTypeCard(typeKey, index))}
    </div>
  )

  if (layout === 'embedded') {
    return (
      <div className="flex min-h-[min(100dvh,52rem)] flex-col px-4 py-6 lg:min-h-[calc(100dvh-11rem)] lg:px-8 lg:py-8">
        {header}
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{grid}</div>
      </div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-[8000] flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label={t('type_selector.title')}
      data-modal="true"
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-8">
        {header}
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">{grid}</div>
      </div>
    </motion.div>
  )
}
