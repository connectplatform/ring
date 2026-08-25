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
import { useCallback, useEffect, useRef, useState } from 'react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import Link from 'next/link'
import { usePathname, useRouter } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { motion } from 'framer-motion'
import { eventBus } from '@/lib/event-bus.client'
import { cn } from '@/lib/utils'
import { useVendorStatus } from '@/hooks/use-vendor-status'
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

export type OpportunityTypeSelectorLayout = 'embedded' | 'overlay' | 'mobile-sheet' | 'body'
export type OpportunityTypeSelectorDensity = 'compact' | 'comfortable'

interface OpportunityTypeSelectorClientProps {
  userRole: 'member' | 'subscriber'
  locale?: Locale
  layout?: OpportunityTypeSelectorLayout
  onClose?: () => void
}

const MOBILE_SHEET_BOTTOM =
  'bottom-[var(--mobile-bottom-nav-h,calc(3.5rem+env(safe-area-inset-bottom,0px)))]'

function densityForLayout(layout: OpportunityTypeSelectorLayout): OpportunityTypeSelectorDensity {
  return layout === 'mobile-sheet' ? 'compact' : 'comfortable'
}

export function OpportunityTypeSelectorClient({
  onClose,
  userRole,
  layout = 'embedded',
}: OpportunityTypeSelectorClientProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const density = densityForLayout(layout)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const prevPathRef = useRef(pathname)

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeReturnTo, setUpgradeReturnTo] = useState(() =>
    ROUTES.ADD_OPPORTUNITY(locale),
  )
  const { hasVendor } = useVendorStatus()

  const resolveTileHref = useCallback(
    (typeKey: OpportunityTypeKey) => {
      const config = opportunitySelectorTypePresets[typeKey]
      if (config.navigationKind === 'opportunity-form') {
        const formType = config.formType ?? typeKey
        return `${ROUTES.ADD_OPPORTUNITY(locale)}?type=${encodeURIComponent(formType)}`
      }
      if (typeKey === 'vendor_listing') {
        return hasVendor
          ? ROUTES.VENDOR_PRODUCTS_ADD(locale)
          : ROUTES.VENDOR_START(locale)
      }
      // Layer1 project_order (and any other route tile) → calculator
      return ROUTES.CALCULATOR(locale)
    },
    [locale, hasVendor],
  )

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
      return
    }
    if (layout === 'embedded') {
      router.push(ROUTES.OPPORTUNITIES(locale) as '/opportunities')
    }
  }, [onClose, layout, router, locale])

  // Escape + eventBus for overlay / mobile-sheet
  useEffect(() => {
    if (layout === 'embedded' || layout === 'body' || layout === 'overlay') return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)

    const unsubscribe = eventBus.on('modal:close-all', handleClose)
    eventBus.emit('modal:opened', {
      modalId: 'opportunity-type-selector',
      zIndex: layout === 'mobile-sheet' ? 8990 : 30,
    })

    return () => {
      window.removeEventListener('keydown', onKey)
      unsubscribe()
      eventBus.emit('modal:closed', { modalId: 'opportunity-type-selector' })
    }
  }, [layout, handleClose])

  // Close on client navigation only. Skip the first run — next-intl
  // `usePathname()` often changes once on hydrate (locale prefix), which
  // would otherwise open-then-immediately-close the '+' sheet.
  const pathReadyRef = useRef(false)
  useEffect(() => {
    if (layout === 'embedded' || layout === 'body' || layout === 'overlay') return
    if (!pathReadyRef.current) {
      pathReadyRef.current = true
      prevPathRef.current = pathname
      return
    }
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      handleClose()
    }
  }, [pathname, layout, handleClose])

  useEffect(() => {
    if (layout === 'embedded' || layout === 'body' || layout === 'overlay') return
    const id = window.requestAnimationFrame(() => headingRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [layout])

  if (showUpgradeModal) {
    return (
      <MembershipUpgradeModal onClose={handleClose} returnTo={upgradeReturnTo} />
    )
  }

  const renderTypeCard = (typeKey: OpportunityTypeKey, index: number) => {
    const config = opportunitySelectorTypePresets[typeKey]
    const Icon = config.icon
    const AccentIcon = config.accentIcon
    const canAccess = !config.requiresMembership || userRole === 'member'
    const compact = density === 'compact'
    const href = resolveTileHref(typeKey)

    return (
      <motion.div
        key={typeKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-0 h-full"
      >
        <BorderBeam
          duration="6s"
          className={cn(davinciGlassSurface, davinciAuthButtonLift, 'h-full')}
          innerClassName={cn(
            davinciBeamInnerSurface,
            'flex h-full min-h-0 flex-col',
            compact ? 'p-3' : 'p-5',
          )}
        >
          <div className={cn('flex items-start justify-between gap-2', compact ? 'mb-2' : 'mb-4')}>
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-xl',
                'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
                'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
                compact ? 'h-11 w-11' : 'h-12 w-12',
              )}
            >
              <Icon className={cn(compact ? 'h-5 w-5' : 'h-6 w-6', 'text-[var(--davinci-beam)]')} />
            </span>
            {!compact && (
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
            )}
            {compact && config.requiresMembership && userRole === 'subscriber' && (
              <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className={cn('flex items-center gap-2', compact ? 'mb-0.5' : 'mb-1')}>
              <h3
                className={cn(
                  'font-semibold leading-tight',
                  compact ? 'text-sm' : 'text-base',
                )}
              >
                {t(`type_selector.${typeKey}.title`)}
              </h3>
              {!compact && (
                <AccentIcon className="h-4 w-4 shrink-0 text-[var(--davinci-beam)]/60" />
              )}
            </div>
            <p
              className={cn(
                'text-muted-foreground',
                compact
                  ? 'mb-2 line-clamp-3 text-xs leading-snug'
                  : 'mb-4 text-sm leading-relaxed',
              )}
            >
              {t(`type_selector.${typeKey}.description`)}
            </p>

            {!compact && (
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
            )}

            <div className="mt-auto pt-1">
              {canAccess ? (
                <Button
                  asChild
                  size={compact ? 'sm' : 'default'}
                  className={cn('w-full', davinciCtaPrimary)}
                >
                  <Link href={href} onClick={onClose}>
                    {compact
                      ? t(`type_selector.${typeKey}.title`)
                      : t(`type_selector.${typeKey}.button`)}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setUpgradeReturnTo(href)
                    setShowUpgradeModal(true)
                  }}
                  variant="outline"
                  size={compact ? 'sm' : 'default'}
                  className="w-full border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)]"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  {compact
                    ? tCommon('membership.title', { defaultValue: 'Member' })
                    : t(`type_selector.${typeKey}.upgrade_button`)}
                </Button>
              )}
            </div>
          </div>
        </BorderBeam>
      </motion.div>
    )
  }

  const header = (
    <div
      className={cn(
        'flex shrink-0 items-start justify-between gap-3',
        'border-b border-[color-mix(in_oklch,var(--davinci-beam)_18%,transparent)]',
        density === 'compact' ? 'pb-3' : 'pb-5',
      )}
    >
      <div className="min-w-0 space-y-1 sm:space-y-2">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl',
              'border border-[color-mix(in_oklch,var(--davinci-beam)_35%,transparent)]',
              'bg-[color-mix(in_oklch,var(--davinci-beam)_12%,transparent)]',
              density === 'compact' ? 'h-9 w-9' : 'h-10 w-10',
            )}
          >
            <LayoutGrid
              className={cn(
                density === 'compact' ? 'h-4 w-4' : 'h-5 w-5',
                'text-[var(--davinci-beam)]',
              )}
            />
          </span>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className={cn(
              'font-bold tracking-tight text-foreground outline-none',
              density === 'compact' ? 'text-lg' : 'text-xl lg:text-2xl',
            )}
          >
            {t('type_selector.title')}
          </h2>
        </div>
        <p
          className={cn(
            'leading-relaxed text-muted-foreground',
            density === 'compact' ? 'line-clamp-2 text-xs' : 'max-w-2xl text-sm',
          )}
        >
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
    <div
      className={cn(
        'grid min-h-0 flex-1 content-stretch',
        'grid-cols-1 md:grid-cols-2',
        OPPORTUNITY_SELECTOR_TYPE_ORDER.length === 4 ? 'md:grid-rows-2' : '',
        density === 'compact' ? 'gap-2.5' : 'gap-4',
      )}
    >
      {OPPORTUNITY_SELECTOR_TYPE_ORDER.map((typeKey, index) => renderTypeCard(typeKey, index))}
    </div>
  )

  const hostedBody = layout === 'body' || layout === 'overlay'

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <HeroAmbient className="pointer-events-none absolute inset-0 opacity-35" />
      <div
        className={cn(
          'relative z-[1] flex min-h-0 flex-1 flex-col',
          hostedBody
            ? 'p-3 sm:p-4'
            : density === 'compact'
              ? 'px-3 py-3'
              : 'px-4 py-6 sm:px-8 lg:py-8',
        )}
      >
        {hostedBody ? null : header}
        <div
          className={cn(
            'min-h-0 flex-1',
            hostedBody
              ? 'overflow-y-auto overscroll-contain'
              : density === 'compact'
                ? 'mt-3 flex flex-col'
                : 'mt-6 overflow-y-auto overscroll-contain',
          )}
        >
          {grid}
        </div>
      </div>
    </div>
  )

  if (layout === 'mobile-sheet') {
    return (
      <div
        id="opportunity-type-selector-mobile"
        className={cn(
          'fixed inset-x-0 top-0 z-[8990] flex flex-col md:hidden',
          MOBILE_SHEET_BOTTOM,
          'border-b border-border/40 bg-[hsl(var(--app-canvas))]/95 shadow-2xl',
        )}
        role="dialog"
        aria-modal="false"
        aria-labelledby="opportunity-type-selector-mobile-title"
      >
        <span id="opportunity-type-selector-mobile-title" className="sr-only">
          {t('type_selector.title')}
        </span>
        {body}
      </div>
    )
  }

  if (layout === 'embedded') {
    return (
      <div
        className={cn(
          'relative flex min-h-full w-full flex-1 flex-col overflow-hidden rounded-xl',
          'min-h-[min(70vh,40rem)]',
          davinciPanelSurface,
        )}
      >
        {body}
      </div>
    )
  }

  // body + overlay: tiles only. FsModal host owns title/close (all viewports).
  return body
}
