'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useSession, SessionProvider } from 'next-auth/react'
import { SlidingPopup } from '@/components/common/widgets/modal'
import { Button } from '@/components/ui/button'
import { ContactForm } from '@/components/common/widgets/contact-form'
import { Opportunity } from '@/types'
import { Lock, Building, Calendar, MapPin, DollarSign, Clock, Tag, FileText, User } from 'lucide-react'
import { Timestamp, FieldValue } from 'firebase/firestore'

const formatDate = (date: Timestamp | FieldValue | undefined) => {
  if (date instanceof Timestamp) {
    return new Date(date.seconds * 1000).toLocaleDateString()
  }
  return 'N/A'
}

function ConfidentialOpportunityDetailsContent({ initialOpportunity }: { initialOpportunity: Opportunity }) {
  const { data: session } = useSession()
  const t = useTranslations('modules.opportunities')
  const [opportunity, setOpportunity] = useState<Opportunity>(initialOpportunity)
  const [isContactPopupOpen, setIsContactPopupOpen] = useState(false)

  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        const response = await fetch(`/api/confidential-opportunities/${opportunity.id}`)
        if (response.ok) {
          const data = await response.json()
          setOpportunity(data)
        } else {
          console.error('Failed to fetch opportunity details')
        }
      } catch (error) {
        console.error('Error fetching opportunity details:', error)
      }
    }

    fetchOpportunity()
  }, [opportunity.id])

  const formatBudget = (budget: { min?: number; max: number; currency?: string }) => {
    const currency = budget.currency || 'USD'
    const min = budget.min || 0
    return `${currency} ${min} - ${currency}${budget.max}`
  }

  const handleCloseContactPopup = async () => {
    setIsContactPopupOpen(false)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center mb-8"
      >
        <Lock className="w-8 h-8 text-destructive mr-2" />
        <h1 className="text-4xl font-bold text-center text-primary">
          {opportunity.title}
        </h1>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <p className="text-lg mb-4 text-muted-foreground">{opportunity.briefDescription}</p>
          {opportunity.tags && (
            <div className="flex flex-wrap gap-2 mb-4">
              {opportunity.tags.map((tag: string) => (
                <span key={tag} className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm shadow">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {opportunity.fullDescription && <p className="mb-4 text-muted-foreground">{opportunity.fullDescription}</p>}
          <div className="flex gap-4">
            <Button
              onClick={() => setIsContactPopupOpen(true)}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-semibold hover:opacity-90 transition-colors shadow"
            >
              {t('opportunity.applyNow')}
            </Button>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-primary">
            {t('opportunity.confidentialDetails')}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <Building className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.organization')}: {opportunity.organizationId}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.dateCreated')}: {formatDate(opportunity.dateCreated)}</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.expirationDate')}: {formatDate(opportunity.expirationDate)}</span>
            </div>
            <div className="flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.location')}: {opportunity.location}</span>
            </div>
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.budget')}: {opportunity.budget ? formatBudget(opportunity.budget) : 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <Tag className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.category')}: {opportunity.category}</span>
            </div>
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.requiredDocuments')}: {opportunity.requiredDocuments?.join(', ') || 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <User className="w-5 h-5 mr-2 text-muted-foreground" />
              <span className="text-muted-foreground">{t('opportunity.requiredSkills')}: {opportunity.requiredSkills?.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
      {opportunity.attachments && opportunity.attachments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-primary">
            {t('opportunity.attachments')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {opportunity.attachments.map((attachment, index) => (
              <a
                key={index}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-100 hover:bg-gray-200 text-foreground px-4 py-2 rounded-lg transition-colors duration-300 flex items-center"
              >
                <FileText className="w-5 h-5 mr-2" />
                <span>{attachment.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <SlidingPopup isOpen={isContactPopupOpen} onCloseAction={handleCloseContactPopup}>
        <ContactForm 
          entityId={opportunity.organizationId} 
          entityName={opportunity.title} 
          initialUserInfo={{
            name: session?.user?.name || '',
            email: session?.user?.email || ''
          }}
        />
      </SlidingPopup>
    </div>
  )
}

export default function ConfidentialOpportunityDetails({ initialOpportunity }: { initialOpportunity: Opportunity }) {
  return (
    <SessionProvider>
      <ConfidentialOpportunityDetailsContent initialOpportunity={initialOpportunity} />
    </SessionProvider>
  )
}
