"use client"

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Users, Building2, Briefcase, ArrowRight, Star, Shield, Globe } from 'lucide-react'
import UpgradeRequestModal from '@/features/auth/components/upgrade-request-modal'
import type { AuthUser, RoleUpgradeRequest } from '@/features/auth/types'
import type { Locale } from '@/i18n-config'
import { ROUTES } from '@/constants/routes'

interface MembershipContentProps {
  user: AuthUser
  locale: Locale
}

export default function MembershipContent({ user, locale }: MembershipContentProps) {
  const t = useTranslations('modules.profile')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [submitState, setSubmitState] = useState<{ success: boolean; message: string }>({
    success: false,
    message: ''
  })

  const handleUpgradeRequest = async (requestData: Partial<RoleUpgradeRequest>) => {
    try {
      // Here you would typically call an API to submit the upgrade request
      console.log('Submitting upgrade request:', requestData)
      
      // For now, just simulate success
      setSubmitState({
        success: true,
        message: t('roleUpgrade.requestSubmitted')
      })
      
      // Redirect to profile after 3 seconds
      setTimeout(() => {
        router.push(ROUTES.PROFILE(locale))
      }, 3000)
      
    } catch (error) {
      console.error('Error submitting upgrade request:', error)
      throw error
    }
  }

  const benefits = [
    {
      icon: Building2,
      title: 'Create Entities',
      description: 'Register your organization and showcase your services'
    },
    {
      icon: Briefcase,
      title: 'Post Opportunities',
      description: 'Share job openings, partnerships, and collaboration requests'
    },
    {
      icon: Users,
      title: 'Join Communities',
      description: 'Connect with other professionals in your industry'
    },
    {
      icon: Globe,
      title: 'Enhanced Visibility',
      description: 'Get discovered by potential partners and clients'
    },
    {
      icon: Shield,
      title: 'Verified Profile',
      description: 'Build trust with a verified member badge'
    },
    {
      icon: Star,
      title: 'Priority Support',
      description: 'Get faster responses from our support team'
    }
  ]

  const comparisonFeatures = [
    { feature: 'View public entities', subscriber: true, member: true },
    { feature: 'View opportunities', subscriber: true, member: true },
    { feature: 'Basic messaging', subscriber: true, member: true },
    { feature: 'Create entities', subscriber: false, member: true },
    { feature: 'Post opportunities', subscriber: false, member: true },
    { feature: 'Advanced analytics', subscriber: false, member: true },
    { feature: 'Priority in search results', subscriber: false, member: true },
    { feature: 'Custom branding', subscriber: false, member: true },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">
            Upgrade to Member
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Unlock the full potential of Ring Platform. Create entities, post opportunities, and grow your professional network.
          </p>
        </motion.div>

        {/* Success Message */}
        {submitState.success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Request Submitted Successfully!</AlertTitle>
              <AlertDescription>
                {submitState.message} We'll review your request and notify you within 24-48 hours.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Pending Request Notice */}
        {user.pendingUpgradeRequest && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <Alert>
              <AlertTitle>Upgrade Request Pending</AlertTitle>
              <AlertDescription>
                You have already submitted an upgrade request on{' '}
                {new Date(user.pendingUpgradeRequest.submittedAt).toLocaleDateString()}.
                Status: <Badge variant="outline">{t(`roleUpgrade.status.${user.pendingUpgradeRequest.status}`)}</Badge>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Benefits Grid */}
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

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-4xl mx-auto mb-12"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Feature Comparison</CardTitle>
              <CardDescription className="text-center">
                See what you'll unlock as a member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Feature</th>
                      <th className="text-center py-3 px-4">
                        <div>
                          <Badge variant="secondary">Subscriber</Badge>
                          <div className="text-xs text-muted-foreground mt-1">(Current)</div>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4">
                        <Badge className="bg-primary">Member</Badge>
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

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Upgrade?</CardTitle>
              <CardDescription>
                Join hundreds of professionals who are already using Ring Platform to grow their business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => setShowUpgradeModal(true)}
                  disabled={!!user.pendingUpgradeRequest}
                  className="gap-2"
                >
                  Request Upgrade <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => router.push(ROUTES.PROFILE(locale))}
                >
                  Back to Profile
                </Button>
              </div>
              
              {!user.pendingUpgradeRequest && (
                <p className="text-sm text-muted-foreground">
                  Upgrade requests are typically reviewed within 24-48 hours
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="max-w-3xl mx-auto mt-12"
        >
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How long does the upgrade process take?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Most upgrade requests are reviewed within 24-48 hours. You'll receive an email notification once your request has been processed.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What information do I need to provide?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We'll ask for basic information about your organization, your role, and why you'd like to upgrade. LinkedIn profile or portfolio links can help speed up the review process.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I downgrade later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes, you can request to change your account type at any time through your profile settings. Note that downgrading may affect your access to certain features.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Upgrade Request Modal */}
        <UpgradeRequestModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          user={user}
          onSubmit={handleUpgradeRequest}
        />
      </div>
    </div>
  )
}
