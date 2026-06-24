"use client"

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Users, Building2, Briefcase, ArrowRight, Star, Shield, Globe } from 'lucide-react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import type { AuthUser } from '@/features/auth/types'
import type { Locale } from '@/i18n/shared'
import { ROUTES } from '@/constants/routes'

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
    <div className="mx-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4">{t('page.title')}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t('page.subtitle')}</p>
      </motion.div>

      {user.pendingUpgradeRequest && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mb-8"
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
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
      >
        {benefits.map((benefit, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <benefit.icon className="h-8 w-8 text-primary" />
                <CardTitle className="text-lg">{benefit.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{benefit.description}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="max-w-4xl mx-auto mb-12"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">{t('page.comparison_title')}</CardTitle>
            <CardDescription className="text-center">{t('page.comparison_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">{t('comparison.feature')}</th>
                    <th className="text-center py-3 px-4">
                      <div>
                        <Badge variant="secondary">{t('comparison.subscriber')}</Badge>
                        <div className="text-xs text-muted-foreground mt-1">{t('page.current_plan')}</div>
                      </div>
                    </th>
                    <th className="text-center py-3 px-4">
                      <Badge className="bg-primary">{t('comparison.member')}</Badge>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((item, index) => (
                    <tr key={index} className="border-b">
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
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="max-w-2xl mx-auto text-center"
      >
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-2xl">{t('page.cta_title')}</CardTitle>
            <CardDescription>{t('page.cta_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="max-w-3xl mx-auto mt-12"
      >
        <h2 className="text-2xl font-bold text-center mb-8">{t('page.faq_title')}</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('page.faq_time_question')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('page.faq_time_answer')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('page.faq_info_question')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('page.faq_info_answer')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('page.faq_downgrade_question')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('page.faq_downgrade_answer')}</p>
            </CardContent>
          </Card>
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
