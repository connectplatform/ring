'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Building,
  Building2,
  Calculator,
  CalendarDays,
  CheckCircle,
  Clock,
  Cloud,
  Factory,
  FlaskConical,
  Globe,
  HardDrive,
  Image,
  Landmark,
  Layers,
  Mail,
  Map,
  MapPin,
  MessageSquare,
  Network,
  Newspaper,
  Radio,
  Server,
  Share2,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Store,
  Target,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { useStorePaymentMethods } from '@/features/store/currency-context'
import { calculateProject } from './engine'
import type { CalculatorInputs, CalculatorResults } from './types'
import { OrderThisBuildButton } from '@/features/crm/orders/order-actions'
import {
  BRANDING_CUSTOMIZATION_POINTS,
  PROJECT_DOMAIN_COLORS,
  PROJECT_EXTERNAL_COLORS,
  PROJECT_EXTERNAL_IDS,
  PROJECT_EXTERNAL_ICONS,
  PROJECT_EXTERNAL_MAIN_CURRENCY,
  PROJECT_HOSTING_IDS,
  PROJECT_MODULE_DOMAIN,
  PROJECT_MODULE_ICONS,
  PROJECT_MODULE_IDS,
  PROJECT_MODULE_POINTS,
  PROJECT_NICHE_COLORS,
  PROJECT_NICHE_ICONS,
  PROJECT_NICHE_IDS,
  PROJECT_NICHE_MODULES,
  PROJECT_SCALE_IDS,
  type ProjectExternalId,
  type ProjectHostingId,
  type ProjectModuleId,
  type ProjectNicheId,
  type ProjectScaleId,
} from './presets/project'
import { creditBalanceUnitToMainCurrency, type CalculatorRates, mainCurrencyToCreditBalanceUnit } from './rates'

const ICON_MAP: Record<string, LucideIcon> = {
  Store,
  Target,
  Users,
  Radio,
  ShoppingBasket,
  FlaskConical,
  Building,
  Shield,
  Building2,
  Briefcase,
  MessageSquare,
  ShoppingBag,
  Newspaper,
  Wallet,
  Image,
  Layers,
  Sparkles,
  Map,
  MapPin,
  CalendarDays,
  Landmark,
  BarChart3,
  Factory,
  Share2,
  Mail,
  HardDrive,
  Globe,
  Network,
  Server,
  Cloud,
}

type CalcT = ReturnType<typeof useTranslations<'calculator'>>

function ToggleTile({
  selected,
  onSelect,
  icon: Icon,
  title,
  subtitle,
  badge,
  accent,
  soft,
  className,
}: {
  selected: boolean
  onSelect: () => void
  icon: LucideIcon
  title: string
  subtitle?: string
  badge?: string
  accent?: string
  soft?: string
  className?: string
}) {
  const color = accent ?? 'hsl(var(--primary))'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all',
        'hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? cn(davinciGlassSurface, 'shadow-sm') : 'border-border/80 bg-background/60',
        className,
      )}
      style={
        selected
          ? {
              borderColor: color,
              backgroundColor: soft,
              boxShadow: `0 0 0 1px ${color}33, 0 8px 24px -12px ${color}66`,
            }
          : accent
            ? { borderColor: `${color}33` }
            : undefined
      }
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-lg border',
            selected ? 'border-transparent' : 'border-border text-muted-foreground',
          )}
          style={
            selected
              ? { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
              : accent
                ? { color }
                : undefined
          }
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        {selected && <CheckCircle className="size-4 shrink-0" style={{ color }} />}
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {badge && (
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
            selected ? 'border-transparent' : 'border-border/60 bg-secondary text-secondary-foreground',
          )}
          style={
            selected
              ? { backgroundColor: `${color}22`, color, borderColor: `${color}44` }
              : undefined
          }
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function getTimelineTasks(t: CalcT, complexity: 'simple' | 'medium' | 'complex') {
  const raw = t.raw(`timelineTasks.${complexity}`) as Record<string, string[]>
  return {
    week1: raw.week1 ?? [],
    week2: raw.week2 ?? [],
    week3: raw.week3 ?? [],
    week4: raw.week4 ?? [],
  }
}

export function CalculatorEngine({
  rates,
  initialHosting,
}: {
  rates: CalculatorRates
  /** Deep-link from roadmap / marketing — preselect hosting (`ringdom` | `self_host`). */
  initialHosting?: ProjectHostingId
}) {
  const t = useTranslations('calculator')
  const locale = useLocale()
  // Same SSOT as /store: left-rail + mobile modal NativeToken ↔ MainCurrency toggle
  const {
    currency,
    displayPrice,
    equivalentCurrency,
    formatPrice,
    convertPrice,
    mainCurrency,
  } = useStorePaymentMethods()

  const [inputs, setInputs] = useState<CalculatorInputs>({
    niche: '',
    scale: '',
    modules: [],
    externals: [],
    hosting: initialHosting && PROJECT_HOSTING_IDS.includes(initialHosting) ? initialHosting : '',
    branding: true,
    needHumanDev: false,
  })
  const [showEstimate, setShowEstimate] = useState(false)

  const selectNiche = (niche: ProjectNicheId) => {
    const packModules = [...PROJECT_NICHE_MODULES[niche]]
    setInputs((prev) => ({
      ...prev,
      niche,
      modules: packModules,
    }))
    setShowEstimate(false)
  }

  const toggleModule = (id: ProjectModuleId) => {
    setInputs((prev) => {
      const has = prev.modules.includes(id)
      return {
        ...prev,
        modules: has ? prev.modules.filter((m) => m !== id) : [...prev.modules, id],
      }
    })
    setShowEstimate(false)
  }

  const toggleExternal = (id: ProjectExternalId) => {
    setInputs((prev) => {
      const has = prev.externals.includes(id)
      return {
        ...prev,
        externals: has ? prev.externals.filter((e) => e !== id) : [...prev.externals, id],
      }
    })
    setShowEstimate(false)
  }

  const livePreview = useMemo(() => {
    if (!inputs.niche || !inputs.scale || !inputs.hosting || inputs.modules.length === 0) {
      return null
    }
    return calculateProject(inputs, {
      rates,
      labels: {
        nicheName: t(`niches.${inputs.niche}.name`),
        hostingLabel: t(`hosting.${inputs.hosting}.name`),
        moduleNames: Object.fromEntries(
          PROJECT_MODULE_IDS.map((id) => [id, t(`modules.${id}.name`)]),
        ),
        externalNames: Object.fromEntries(
          PROJECT_EXTERNAL_IDS.map((id) => [id, t(`externals.${id}.name`)]),
        ),
      },
      timelineTasks: {
        simple: getTimelineTasks(t, 'simple'),
        medium: getTimelineTasks(t, 'medium'),
        complex: getTimelineTasks(t, 'complex'),
      },
    })
  }, [inputs, rates, t])

  const isFormValid =
    !!inputs.niche && !!inputs.scale && !!inputs.hosting && inputs.modules.length > 0

  const display = livePreview

  /** Catalog points → store.mainCurrency → active rail currency (RING/USD/…). */
  const fmt = (points: number) => {
    const maincurrency = creditBalanceUnitToMainCurrency(points, rates)
    return displayPrice(maincurrency, mainCurrency)
  }

  const fmtEquivalent = (points: number) => {
    const maincurrency = creditBalanceUnitToMainCurrency(points, rates)
    return formatPrice(convertPrice(maincurrency, mainCurrency, equivalentCurrency), equivalentCurrency)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
      <header className="space-y-2 text-center">
        <h1 className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight">
          <Calculator className="size-8 text-primary" />
          {t('hero.title')}
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">{t('hero.subtitle')}</p>
        <p className="text-xs text-muted-foreground">
          {t('results.rateDetail', {
            pointsPerToken: String(rates.creditBalanceUnitPerNativeToken),
            token: rates.nativeTokenSymbol,
            currency: rates.mainCurrency,
            unitRate: String(rates.creditBalanceUnitToMainCurrency),
            creditBalanceUnit: rates.creditBalanceUnitLabel,
          })}
        </p>
      </header>

      <div className="space-y-8">
        {/* Niche packs */}
        <section className="space-y-3">
          <div>
            <Label className="text-base font-semibold">{t('sections.niches')}</Label>
            <p className="text-sm text-muted-foreground">{t('sections.nichesHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PROJECT_NICHE_IDS.map((id) => {
              const Icon = ICON_MAP[PROJECT_NICHE_ICONS[id]] ?? Store
              const colors = PROJECT_NICHE_COLORS[id]
              return (
                <ToggleTile
                  key={id}
                  selected={inputs.niche === id}
                  onSelect={() => selectNiche(id)}
                  icon={Icon}
                  title={t(`niches.${id}.name`)}
                  subtitle={t(`niches.${id}.description`)}
                  accent={colors.accent}
                  soft={colors.soft}
                />
              )
            })}
          </div>
        </section>

        {/* Modules */}
        <section className="space-y-3">
          <div>
            <Label className="text-base font-semibold">{t('sections.modules')}</Label>
            <p className="text-sm text-muted-foreground">{t('sections.modulesHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {PROJECT_MODULE_IDS.map((id) => {
              const Icon = ICON_MAP[PROJECT_MODULE_ICONS[id]] ?? Sparkles
              const domain = PROJECT_MODULE_DOMAIN[id]
              const colors = PROJECT_DOMAIN_COLORS[domain]
              const inPack =
                inputs.niche &&
                PROJECT_NICHE_MODULES[inputs.niche as ProjectNicheId]?.includes(id)
              const pts = PROJECT_MODULE_POINTS[id]
              return (
                <ToggleTile
                  key={id}
                  selected={inputs.modules.includes(id)}
                  onSelect={() => toggleModule(id)}
                  icon={Icon}
                  title={t(`modules.${id}.name`)}
                  subtitle={t(`modules.${id}.description`)}
                  accent={colors.accent}
                  soft={colors.soft}
                  badge={
                    inPack
                      ? t('labels.inPack')
                      : `${fmt(pts)} · ${t(`domains.${domain}`)}`
                  }
                />
              )
            })}
          </div>
        </section>

        {/* Externals */}
        <section className="space-y-3">
          <div>
            <Label className="text-base font-semibold">{t('sections.externals')}</Label>
            <p className="text-sm text-muted-foreground">{t('sections.externalsHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PROJECT_EXTERNAL_IDS.map((id) => {
              const Icon = ICON_MAP[PROJECT_EXTERNAL_ICONS[id]] ?? Globe
              const colors = PROJECT_EXTERNAL_COLORS[id]
              const pts = mainCurrencyToCreditBalanceUnit(PROJECT_EXTERNAL_MAIN_CURRENCY[id], rates)
              return (
                <ToggleTile
                  key={id}
                  selected={inputs.externals.includes(id)}
                  onSelect={() => toggleExternal(id)}
                  icon={Icon}
                  title={t(`externals.${id}.name`)}
                  subtitle={t(`externals.${id}.description`)}
                  accent={colors.accent}
                  soft={colors.soft}
                  badge={t('labels.perMonth', { cost: fmt(pts) })}
                />
              )
            })}
          </div>
        </section>

        {/* Scale */}
        <section className="space-y-3">
          <Label className="text-base font-semibold">{t('sections.scale')}</Label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PROJECT_SCALE_IDS.map((id) => (
              <ToggleTile
                key={id}
                selected={inputs.scale === id}
                onSelect={() => {
                  setInputs((p) => ({ ...p, scale: id as ProjectScaleId }))
                  setShowEstimate(false)
                }}
                icon={Users}
                title={t(`scales.${id}.name`)}
                subtitle={t(`scales.${id}.description`)}
                accent="#64748B"
                soft="rgba(100, 116, 139, 0.12)"
              />
            ))}
          </div>
        </section>

        {/* Hosting */}
        <section className="space-y-3">
          <Label className="text-base font-semibold">{t('sections.hosting')}</Label>
          <p className="text-sm text-muted-foreground">{t('sections.hostingHint')}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {PROJECT_HOSTING_IDS.map((id) => {
              const Icon = id === 'self_host' ? Server : Cloud
              const accent = id === 'self_host' ? '#64748B' : '#0EA5E9'
              const soft =
                id === 'self_host' ? 'rgba(100, 116, 139, 0.12)' : 'rgba(14, 165, 233, 0.14)'
              return (
                <ToggleTile
                  key={id}
                  selected={inputs.hosting === id}
                  onSelect={() => {
                    setInputs((p) => ({ ...p, hosting: id as ProjectHostingId }))
                    setShowEstimate(false)
                  }}
                  icon={Icon}
                  title={t(`hosting.${id}.name`)}
                  subtitle={t(`hosting.${id}.description`)}
                  accent={accent}
                  soft={soft}
                />
              )
            })}
          </div>
        </section>

        {/* Human integrator + branding */}
        <section className="grid gap-3 md:grid-cols-2">
          <div
            className={cn(
              'flex flex-col gap-3 rounded-xl border-2 p-4',
              inputs.needHumanDev ? davinciGlassSurface : 'border-border/80 bg-background/60',
            )}
            style={
              inputs.needHumanDev
                ? {
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t('humanDev.title')}</div>
                <div className="text-xs text-muted-foreground">{t('humanDev.description')}</div>
              </div>
              <Switch
                checked={inputs.needHumanDev}
                onCheckedChange={(checked) => {
                  setInputs((p) => ({ ...p, needHumanDev: checked }))
                }}
                aria-label={t('humanDev.title')}
              />
            </div>
            {inputs.needHumanDev && (
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <AlertCircle className="size-4 text-amber-600" />
                <AlertDescription className="text-xs">{t('humanDev.hint')}</AlertDescription>
              </Alert>
            )}
          </div>

          <ToggleTile
            selected={inputs.branding}
            onSelect={() => {
              setInputs((p) => ({ ...p, branding: !p.branding }))
              setShowEstimate(false)
            }}
            icon={Sparkles}
            title={t('branding.title')}
            subtitle={t('branding.description')}
            badge={t('branding.badge', { cost: fmt(BRANDING_CUSTOMIZATION_POINTS) })}
            accent="#EC4899"
            soft="rgba(236, 72, 153, 0.12)"
            className="h-full"
          />
        </section>

        {/* Full estimate (inline, no tabs) */}
        {showEstimate && display && (
          <EstimatePanel
            display={display}
            inputs={inputs}
            fmt={fmt}
            fmtEquivalent={fmtEquivalent}
            currencyLabel={String(currency)}
            locale={locale}
            t={t}
          />
        )}
      </div>

      {/* Sticky cost preview — clears mobile bottom nav; currency from left-rail / mobile menu */}
      {display && (
        <div
          className={cn(
            'fixed inset-x-0 z-40 border-t shadow-lg backdrop-blur-md',
            'davinci-panel-surface',
            // Clear mobile bottom nav (~4.25rem) + safe area; float above edge on desktop
            'bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-4',
            'lg:left-auto lg:right-auto lg:mx-auto lg:w-[min(64rem,calc(100%-2rem))] lg:rounded-xl lg:border',
          )}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 p-3 sm:p-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-4 sm:gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                  {t('results.oneTime')}
                </div>
                <div className="text-lg font-bold sm:text-xl">{fmt(display.oneTimePoints)}</div>
                <div className="text-[10px] text-muted-foreground sm:text-xs">
                  ≈ {fmtEquivalent(display.oneTimePoints)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                  {t('results.monthly')}
                </div>
                <div className="text-lg font-bold sm:text-xl">{fmt(display.monthlyPoints)}</div>
                <div className="text-[10px] text-muted-foreground sm:text-xs">
                  ≈ {fmtEquivalent(display.monthlyPoints)}
                </div>
              </div>
              {display.packSavingsPoints > 0 && (
                <div className="hidden sm:block">
                  <div className="text-xs text-muted-foreground">{t('results.packSavings')}</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    −{fmt(display.packSavingsPoints)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden text-xs text-muted-foreground sm:block" title={t('displayUnit.railHint')}>
                {t('displayUnit.active', { currency: String(currency) })}
              </div>
              <Button
                onClick={() => setShowEstimate(true)}
                disabled={!isFormValid}
                size="lg"
                className="shrink-0"
              >
                <Zap className="mr-2 size-4" />
                {t('calculate')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!display && (
        <Button disabled className="w-full" size="lg">
          <Zap className="mr-2 size-4" />
          {t('calculate')}
        </Button>
      )}
    </div>
  )
}

function EstimatePanel({
  display,
  inputs,
  fmt,
  fmtEquivalent,
  currencyLabel,
  locale,
  t,
}: {
  display: CalculatorResults
  inputs: CalculatorInputs
  fmt: (points: number) => string
  fmtEquivalent: (points: number) => string
  currencyLabel: string
  locale: string
  t: CalcT
}) {
  const rates = display.rates
  return (
    <section className={cn('space-y-6 rounded-[15px] border p-5', davinciGlassSurface)}>
      <h2 className="text-lg font-semibold">{t('results.title')}</h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Calculator}
          value={fmt(display.oneTimePoints)}
          label={t('results.oneTime')}
          hint={`≈ ${fmtEquivalent(display.oneTimePoints)}`}
        />
        <StatCard
          icon={Cloud}
          value={fmt(display.monthlyPoints)}
          label={t('results.monthly')}
          hint={`≈ ${fmtEquivalent(display.monthlyPoints)}`}
        />
        <StatCard icon={Clock} value={String(display.estimatedHours)} label={t('results.hours')} />
        <StatCard
          icon={CheckCircle}
          value={t(`complexity.${display.complexity}`)}
          label={t('results.complexityLabel')}
          iconClass={
            display.complexity === 'simple'
              ? 'text-emerald-500'
              : display.complexity === 'medium'
                ? 'text-amber-500'
                : 'text-rose-500'
          }
        />
      </div>

      {display.packSavingsPoints > 0 && (
        <Alert>
          <CheckCircle className="size-4" />
          <AlertDescription>
            {t('results.packSavingsDetail', {
              savings: fmt(display.packSavingsPoints),
              alaCarte: fmt(display.alaCartePoints),
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 rounded-xl border p-5">
        <h3 className="text-base font-semibold">{t('results.recommendedConfig')}</h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">{t('results.niche')}</dt>
            <dd className="text-muted-foreground">{display.recommendedConfig.niche}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('results.hosting')}</dt>
            <dd className="text-muted-foreground">{display.recommendedConfig.hosting}</dd>
          </div>
          <div>
            <dt className="font-medium">{t('results.rate')}</dt>
            <dd className="text-muted-foreground">
              {t('results.rateDetail', {
                pointsPerToken: String(rates.creditBalanceUnitPerNativeToken),
                token: rates.nativeTokenSymbol,
                currency: rates.mainCurrency,
                unitRate: String(rates.creditBalanceUnitToMainCurrency),
                creditBalanceUnit: rates.creditBalanceUnitLabel,
              })}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t('displayUnit.label')}</dt>
            <dd className="text-muted-foreground">
              {t('displayUnit.active', { currency: currencyLabel })}
            </dd>
          </div>
        </dl>
        {display.recommendedConfig.needHumanDev && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="size-4 text-amber-600" />
            <AlertDescription className="text-xs">{t('humanDev.hint')}</AlertDescription>
          </Alert>
        )}
        <div>
          <div className="mb-2 text-sm font-medium">{t('results.features')}</div>
          <div className="flex flex-wrap gap-2">
            {display.recommendedConfig.modules.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        </div>
        {display.recommendedConfig.externals.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">{t('results.externals')}</div>
            <div className="flex flex-wrap gap-2">
              {display.recommendedConfig.externals.map((name) => (
                <Badge key={name} variant="outline">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border p-5">
        <div>
          <h3 className="text-base font-semibold">{t('results.timeline')}</h3>
          <p className="text-sm text-muted-foreground">{t('results.timelineDescription')}</p>
        </div>
        {Object.entries(display.timeline).map(([week, tasks], index) => (
          <div key={week} className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {index + 1}
            </div>
            <div>
              <div className="font-medium">{t(`timeline.${week}` as 'timeline.week1')}</div>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {tasks.map((task) => (
                  <li key={task} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border p-5">
        <h3 className="text-base font-semibold">{t('results.complexity')}</h3>
        <div className="flex justify-between text-sm">
          <span>{t('results.complexityLevel')}</span>
          <span>{display.customizationComplexity}%</span>
        </div>
        <Progress value={display.customizationComplexity} />
        <p className="text-sm text-muted-foreground">
          {display.customizationComplexity < 30
            ? t('results.complexityHint.low')
            : display.customizationComplexity < 70
              ? t('results.complexityHint.medium')
              : t('results.complexityHint.high')}
        </p>
      </div>

      <div className="space-y-4 rounded-xl border p-5">
        <h3 className="text-base font-semibold">{t('results.nextSteps')}</h3>
        <OrderThisBuildButton inputs={inputs} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="secondary">
            <Link href={`/${locale}/docs/customization/ringization-playbook`}>
              {t('actions.selfBuildPlaybook')}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/${locale}/contact`}>{t('actions.contact')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://ringdom.org/settler" target="_blank" rel="noopener noreferrer">
              {t('actions.becomeSettler')}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/opportunities?types=ring_customization`}>
              {t('actions.findDevelopers')}
            </Link>
          </Button>
        </div>
        {display.complexity === 'complex' && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>{t('results.complexAlert')}</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
  hint,
  iconClass,
}: {
  icon: LucideIcon
  value: string
  label: string
  hint?: string
  iconClass?: string
}) {
  return (
    <div className={cn('rounded-xl border p-4', davinciGlassSurface)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('size-5 text-primary', iconClass)} />
        <div>
          <div className="text-lg font-bold leading-tight sm:text-xl">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
    </div>
  )
}
