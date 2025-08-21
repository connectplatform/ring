'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Briefcase, Crown, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { MembershipUpgradeModal } from '@/components/membership/upgrade-modal'
import Link from 'next/link'
import type { Locale } from '@/i18n-config'

interface OpportunityTypeSelectorProps {
  onClose: () => void
  userRole: 'member' | 'subscriber'
  locale: Locale
}

export function OpportunityTypeSelector({ onClose, userRole, locale }: OpportunityTypeSelectorProps) {
  const t = useTranslations('modules.opportunities')
  const tCommon = useTranslations('common')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  
  if (showUpgradeModal) {
    return (
      <MembershipUpgradeModal 
        onClose={onClose}
        returnTo={`/${locale}/opportunities/add?type=offer`}
      />
    )
  }
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>{t('type_selector.title', { defaultValue: 'What would you like to create?' })}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Request Option */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <span>{t('type_selector.request.title', { defaultValue: 'Request' })}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('type_selector.request.description', { 
                  defaultValue: 'Looking for services, advice, or collaboration from others in the community.' 
                })}
              </p>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t('type_selector.examples', { defaultValue: 'Examples' })}:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• {t('type_selector.request.examples.freelancer', { defaultValue: 'Need a freelancer for my project' })}</li>
                  <li>• {t('type_selector.request.examples.service', { defaultValue: 'Looking for consulting services' })}</li>
                  <li>• {t('type_selector.request.examples.advice', { defaultValue: 'Seeking professional advice' })}</li>
                </ul>
              </div>
              
              <Button asChild className="w-full">
                <Link href={`/${locale}/opportunities/add?type=request`}>
                  {t('type_selector.request.button', { defaultValue: 'Create Request' })}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          
          {/* Offer Option */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-green-500" />
                <span>{t('type_selector.offer.title', { defaultValue: 'Offer' })}</span>
                {userRole === 'subscriber' && (
                  <Crown className="h-4 w-4 text-yellow-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('type_selector.offer.description', { 
                  defaultValue: 'Post official opportunities from your organization or business.' 
                })}
              </p>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t('type_selector.examples', { defaultValue: 'Examples' })}:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• {t('type_selector.offer.examples.job', { defaultValue: 'Job opening at my company' })}</li>
                  <li>• {t('type_selector.offer.examples.partnership', { defaultValue: 'Partnership opportunity' })}</li>
                  <li>• {t('type_selector.offer.examples.investment', { defaultValue: 'Investment opportunity' })}</li>
                </ul>
              </div>
              
              {userRole === 'member' ? (
                <Button asChild className="w-full">
                  <Link href={`/${locale}/opportunities/add?type=offer`}>
                    {t('type_selector.offer.button', { defaultValue: 'Create Offer' })}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Crown className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">
                        {t('type_selector.offer.member_required', { defaultValue: 'Member Access Required' })}
                      </span>
                    </div>
                    <p className="text-xs text-yellow-700">
                      {t('type_selector.offer.upgrade_message', { 
                        defaultValue: 'Upgrade to Member to post offers from your organization.' 
                      })}
                    </p>
                  </div>
                  
                  <Button 
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full"
                    variant="outline"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    {t('type_selector.offer.upgrade_button', { defaultValue: 'Upgrade to Member' })}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="flex justify-center">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('actions.cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
