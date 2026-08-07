"use client"

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Users, Building2, Briefcase, ArrowRight, Star, Shield, Globe } from 'lucide-react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import type { AuthUser } from '@/features/auth/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import {
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'

const INSET = 'px-4 sm:px-5 lg:px-6'
const BAND_Y = 'py-10 sm:py-12 lg:py-14'

interface MembershipContentProps {
  user: AuthUser
  locale: Locale
}

export default function MembershipContent({ user, locale }: MembershipContentProps) {
  const t = useTranslations('modules.membership')
  const tProfile = useTranslations('modules.profile')
  const router = useRouter()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const benefits = [
    { icon: Building2, title: t('benefits.entity_management.title'), description: t('benefits.entity_management.description') },
    { icon: Briefcase, title: t('benefits.premium_features.title'), description: t('benefits.premium_features.description') },
    { icon: Users, title: t('benefits.advanced_networking.title'), description: t('benefits.advanced_networking.description') },
    { icon: Globe, title: t('benefits.enhanced_visibility.title'), description: t('benefits.enhanced_visibility.description') },
    { icon: Shield, title: t('benefits.verified_profile.title'), description: t('benefits.verified_profile.description') },
    { icon: Star, title: t('benefits.priority_support.title'), description: t('benefits.priority_support.description') },
  ]

  const comparisonFeatures = [
    { feature: t('features.view_entities'), subscriber: true, member: true },
    { feature: t('features.view_opportunities'), subscriber: true, member: true },
    { feature: t('features.basic_messaging'), subscriber: true, member: true },
    { feature: t('features.create_entities'), subscriber: false, member: true },
    { feature: t('features.post_opportunities'), subscriber: false, member: true },
    { feature: t('features.advanced_analytics'), subscriber: false, member: true },
    { feature: t('features.priority_search'), subscriber: false, member: true },
    { feature: t('features.custom_branding'), subscriber: false, member: true },
  ]

  return (
    <div className={cn('w-full min-w-0', BAND_Y)}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(INSET, 'text-center mb-10')}
      >
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">{t('page.title')}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('page.subtitle')}</p>
      </motion.div>

      {user.pendingUpgradeRequest && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(INSET, 'max-w-2xl mx-auto mb-8')}
        >
          <Alert>
            <AlertTitle>{t('page.pending_title')}</AlertTitle>
            <AlertDescription>
              {t('page.pending_description', {
                date: new Date(user.pendingUpgradeRequest.submittedAt).toLocaleDateString(),
                status: tProfile(`roleUpgrade.status.${user.pendingUpgradeRequest.status}`),
              })}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className={cn(INSET, 'grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10')}
      >
        {benefits.map((benefit, index) => (
          <div key={index} className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4')}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_oklch,var(--davinci-beam)_28%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)]">
              <benefit.icon className="h-5 w-5 text-[var(--davinci-beam)]" />
            </div>
            <h3 className="mb-1.5 text-base font-semibold">{benefit.title}</h3>
            <p className="text-sm text-muted-foreground">{benefit.description}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className={cn(INSET, 'max-w-4xl mx-auto mb-10')}
      >
        <div className={cn(davinciGlassSurface, davinciBeamInnerSurface, 'p-4 sm:p-5')}>
          <div className="mb-4 text-center">
            <h2 className="text-xl font-bold sm:text-2xl">{t('page.comparison_title')}</h2>
            <p className="text-sm text-muted-foreground sm:text-base">{t('page.comparison_subtitle')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--davinci-glass-border)]">
                  <th className="text-left py-3 px-4">{t('comparison.feature')}</th>
                  <th className="text-center py-3 px-4">
                    <div className="flex flex-col items-center gap-1">
                      <DavinciGlassChip>{t('comparison.subscriber')}</DavinciGlassChip>
                      <span className="text-xs text-muted-foreground">{t('page.current_plan')}</span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-4">
                    <DavinciGlassChip icon={<Star className="h-3 w-3" />}>{t('comparison.member')}</DavinciGlassChip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((item, index) => (
                  <tr key={index} className="border-b border-[var(--davinci-glass-border)]">
                    <td className="py-3 px-4">{item.feature}</td>
                    <td className="text-center py-3 px-4">
                      {item.subscriber ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4">
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={cn(INSET, 'max-w-2xl mx-auto text-center')}
      >
        <div
          className={cn(
            davinciGlassSurface,
            'border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)] p-5 sm:p-6 space-y-4',
          )}
        >
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">{t('page.cta_title')}</h2>
            <p className="text-sm text-muted-foreground sm:text-base">{t('page.cta_subtitle')}</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setShowUpgradeModal(true)}
              disabled={!!user.pendingUpgradeRequest}
              className="gap-2"
              data-testid="button-membership-upgrade-now"
            >
              {t('page.upgrade_now')} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push(ROUTES.PROFILE(locale))}
            >
              {t('page.back_to_profile')}
            </Button>
          </div>
          {!user.pendingUpgradeRequest && (
            <p className="text-sm text-muted-foreground">{t('page.upgrade_notice')}</p>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className={cn(INSET, 'max-w-3xl mx-auto mt-10')}
      >
        <h2 className="text-2xl font-bold text-center mb-6">{t('page.faq_title')}</h2>
        <div className="space-y-3">
          <div className={cn(davinciGlassSurface, 'p-4')}>
            <h3 className="mb-1.5 text-base font-semibold">{t('page.faq_time_question')}</h3>
            <p className="text-sm text-muted-foreground">{t('page.faq_time_answer')}</p>
          </div>
          <div className={cn(davinciGlassSurface, 'p-4')}>
            <h3 className="mb-1.5 text-base font-semibold">{t('page.faq_info_question')}</h3>
            <p className="text-sm text-muted-foreground">{t('page.faq_info_answer')}</p>
          </div>
          <div className={cn(davinciGlassSurface, 'p-4')}>
            <h3 className="mb-1.5 text-base font-semibold">{t('page.faq_downgrade_question')}</h3>
            <p className="text-sm text-muted-foreground">{t('page.faq_downgrade_answer')}</p>
          </div>
        </div>
      </motion.div>

      {showUpgradeModal && (
        <MembershipUpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          returnTo={ROUTES.PROFILE(locale)}
        />
      )}
    </div>
  )
}
