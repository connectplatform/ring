'use client'

/**
 * Entity form layout — center content + transparent right guidance rail (add/edit).
 * Locale keys: modules.entities.addEntity.rail.*
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { entityTypeConfigs } from '@/components/entities/entity-type-icons'
import type { EntityType } from '@/features/entities/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import {
  Building2,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen,
  FileText,
  Tag,
  Eye,
  Shield,
  Award,
  Users,
  Globe,
  Mail,
  MapPin,
  Briefcase,
  Store,
  MessageSquare,
  Sparkles,
} from 'lucide-react'

/** Featured types shown in the rail (form supports all 26 via entityTypeConfigs). */
const FEATURED_ENTITY_TYPES: EntityType[] = [
  'technologySoftware',
  'financialServices',
  'professionalServices',
  'researchDevelopment',
  'educationTraining',
  'nonProfitNgo',
  'manufacturingIndustry',
  'other',
]

interface EntityFormWrapperProps {
  children: React.ReactNode
  locale: Locale
}

export default function EntityFormWrapper({ children, locale }: EntityFormWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.entities')
  const tRail = useTranslations('modules.entities.addEntity.rail')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const featuredTypes = useMemo(
    () =>
      FEATURED_ENTITY_TYPES.map((id) => entityTypeConfigs.find((c) => c.id === id)).filter(
        (c): c is (typeof entityTypeConfigs)[number] => Boolean(c)
      ),
    []
  )

  const fieldGuide = [
    { field: 'name', title: t('fields.name'), required: true, tip: t('fieldTips.name'), icon: Building2 },
    {
      field: 'shortDescription',
      title: t('shortDescription'),
      required: true,
      tip: tRail('fieldTips.shortDescription'),
      icon: FileText,
    },
    {
      field: 'location',
      title: t('location'),
      required: true,
      tip: tRail('fieldTips.location'),
      icon: MapPin,
    },
    {
      field: 'website',
      title: t('fields.website'),
      required: false,
      tip: t('fieldTips.website'),
      icon: Globe,
    },
    {
      field: 'contactEmail',
      title: t('contactEmail'),
      required: false,
      tip: tRail('fieldTips.contactEmail'),
      icon: Mail,
    },
    { field: 'tags', title: t('fields.tags'), required: false, tip: t('fieldTips.tags'), icon: Tag },
    {
      field: 'visibility',
      title: t('entity.visibility'),
      required: true,
      tip: tRail('fieldTips.visibility'),
      icon: Eye,
    },
  ]

  const unlockKeys = ['showcase', 'opportunities', 'store', 'messaging'] as const
  const unlockIcons = {
    showcase: Sparkles,
    opportunities: Briefcase,
    store: Store,
    messaging: MessageSquare,
  }

  const verificationTips = [
    {
      id: 'official',
      title: t('verification.official'),
      description: t('verification.officialDesc'),
      icon: Shield,
      priority: 'high' as const,
    },
    {
      id: 'accurate',
      title: t('verification.accurate'),
      description: t('verification.accurateDesc'),
      icon: CheckCircle,
      priority: 'medium' as const,
    },
    {
      id: 'complete',
      title: t('verification.complete'),
      description: t('verification.completeDesc'),
      icon: Info,
      priority: 'medium' as const,
    },
    {
      id: 'unique',
      title: t('verification.unique'),
      description: t('verification.uniqueDesc'),
      icon: AlertTriangle,
      priority: 'low' as const,
    },
  ]

  const visibilityOptions = [
    {
      id: 'public',
      name: t('visibility.public'),
      description: t('visibility.publicDesc'),
      icon: Eye,
    },
    {
      id: 'members',
      name: t('visibility.members'),
      description: t('visibility.membersDesc'),
      icon: Users,
    },
  ]

  const RightSidebarContent = () => (
    <div className="flex flex-col min-h-0 text-foreground space-y-6">
      {/* What is an entity on Ring Platform */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5 shrink-0" />
          {tRail('whatIsEntity.title')}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{tRail('whatIsEntity.description')}</p>
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">
          {tRail('whatIsEntity.connectNote')}
        </p>
      </section>

      <Separator />

      {/* What creating an entity unlocks */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{tRail('unlocks.title')}</h2>
        <ul className="space-y-3">
          {unlockKeys.map((key) => {
            const Icon = unlockIcons[key]
            return (
              <li key={key} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium">{tRail(`unlocks.${key}.title`)}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tRail(`unlocks.${key}.description`)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <Separator />

      {/* Industry types (26 professional categories; legacy slugs resolved at display time) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">{tRail('industryTypes.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{tRail('industryTypes.subtitle')}</p>
        </div>
        <ul className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {featuredTypes.map((config) => {
            const Icon = config.icon
            const label = t(`types.${config.id}`)
            const description = t(`types.${config.id}Desc`)
            return (
              <li
                key={config.id}
                className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-accent/50 transition-colors"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{tRail('industryTypes.moreInForm')}</p>
      </section>

      <Separator />

      {/* Field guide */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0" />
          {t('fieldGuide')}
        </h2>
        <ul className="space-y-3">
          {fieldGuide.map((field) => (
            <li key={field.field} className="flex items-start gap-2.5">
              <div className="p-1 bg-primary/10 rounded mt-0.5">
                <field.icon className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-medium">{field.title}</p>
                  {field.required && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {t('required')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{field.tip}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Separator />

      {/* Verification */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 shrink-0" />
          {t('verificationTips')}
        </h2>
        <ul className="space-y-2.5">
          {verificationTips.map((tip) => (
            <li key={tip.id} className="flex items-start gap-2.5">
              <tip.icon
                className={`h-4 w-4 shrink-0 mt-0.5 ${
                  tip.priority === 'high'
                    ? 'text-destructive'
                    : tip.priority === 'medium'
                      ? 'text-amber-600'
                      : 'text-muted-foreground'
                }`}
              />
              <div>
                <p className="text-sm font-medium">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Separator />

      {/* Visibility */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" />
          {t('visibilityOptions')}
        </h2>
        <ul className="space-y-2">
          {visibilityOptions.map((option) => (
            <li key={option.id} className="flex items-start gap-2.5 text-sm">
              <option.icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">{option.name}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Award className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {tRail('confidentialNote')}
        </p>
      </section>

      <Separator />

      {/* Help */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0" />
          {t('help')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('entityHelpDescription')}</p>
        <div className="flex flex-col items-start gap-1">
          <Button
            variant="link"
            className="p-0 h-auto text-xs"
            onClick={() => router.push(`${ROUTES.DOCS(locale)}/entities/creating`)}
          >
            {t('creatingEntities')} →
          </Button>
          <Button
            variant="link"
            className="p-0 h-auto text-xs"
            onClick={() => router.push(`${ROUTES.DOCS(locale)}/entities/best-practices`)}
          >
            {t('bestPractices')} →
          </Button>
        </div>
      </section>
    </div>
  )

  if (!mounted) {
    return <div className="min-h-[40vh]">{children}</div>
  }

  return (
    <RingRightRailLayout
      rightRail={<RightSidebarContent />}
      isOpen={rightSidebarOpen}
      onToggle={setRightSidebarOpen}
      contentClassName="pb-24 lg:pb-8"
    >
      {children}
    </RingRightRailLayout>
  )
}
