'use client'

import React, { useState, useEffect } from 'react'
import { useSession, SessionProvider } from '@/components/providers/session-provider'
import { SerializedOpportunity, OpportunityVisibility } from '@/features/opportunities/types'
import { SerializedEntity } from '@/features/entities/types'

import LoginForm from '@/features/auth/components/login-form'
import { useTranslations } from 'next-intl'
import { getOpportunityById } from '@/features/opportunities/services'

/**
 * Represents an attachment for an opportunity
 * @typedef {Object} Attachment
 * @property {string} url - The URL of the attachment
 * @property {string} name - The name of the attachment
 */
interface Attachment {
  url: string;
  name: string;
}

/**
 * Props for the opportunity-details component
 * @typedef {Object} OpportunityDetailsProps
 * @property {Opportunity} initialOpportunity - The initial opportunity data
 * @property {Entity | null} initialEntity - The initial entity data (can be null)
 * @property {string | null} initialError - Any initial error message (can be null)
 */
export interface OpportunityDetailsProps {
  initialOpportunity: SerializedOpportunity & {
    attachments?: Attachment[];
    visibility: OpportunityVisibility;
    expirationDate: string;
  };
  initialEntity: SerializedEntity | null;
  initialError: string | null;
}

/**
 * OpportunityDetailsContent component
 * Renders the details of an opportunity
 * 
 * User steps:
 * 1. User views the opportunity details
 * 2. If not logged in, user is prompted to log in
 * 3. If logged in, user sees opportunity details based on their role
 * 4. Confidential information is only shown to users with appropriate roles
 * 
 * @param {OpportunityDetailsProps} props - The component props
 * @returns {React.ReactElement} The rendered opportunity details
 */
const OpportunityDetailsContent: React.FC<OpportunityDetailsProps> = ({ initialOpportunity, initialEntity, initialError }) => {
  const { data: session, status } = useSession()
  const t = useTranslations('modules.opportunities')
  const isConfidential = initialOpportunity.visibility === 'confidential' as OpportunityVisibility;

  if (status === 'loading') {
    return <div>{t('loading')}</div>
  }

  if (!session) {
    return <LoginForm />
  }

  const userRole = session.user?.role || 'subscriber'
  const canViewConfidential = userRole === 'confidential' || userRole === 'admin'

  if (isConfidential && !canViewConfidential) {
    return <div>{t('noPermission')}</div>
  }

  if (initialError) {
    return <div className="text-red-500">{initialError}</div>
  }

  if (!initialEntity) {
    return <div>{t('noDataAvailable')}</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{initialOpportunity.title}</h1>
      {isConfidential && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
          <p className="font-bold">{t('confidentialOpportunity')}</p>
          <p>{t('confidentialOpportunityDescription')}</p>
        </div>
      )}
      <p className="text-lg mb-4">{initialOpportunity.briefDescription}</p>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <h2 className="text-xl font-semibold mb-2">{t('organizationDetails')}</h2>
        <p><strong>{t('name')}:</strong> {initialEntity.name}</p>
        <p><strong>{t('type')}:</strong> {initialEntity.type}</p>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">{t('opportunityDetails')}</h2>
        <p><strong>{t('type')}:</strong> {initialOpportunity.type}</p>
        <p><strong>{t('location')}:</strong> {initialOpportunity.location}</p>
        <p><strong>{t('expirationDate')}:</strong> {new Date(initialOpportunity.expirationDate).toLocaleDateString()}</p>
      </div>
      
      <div className="whitespace-pre-wrap mb-4">{initialOpportunity.fullDescription}</div>
      
      {initialOpportunity.attachments && initialOpportunity.attachments.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">{t('attachments')}:</h3>
          <ul className="list-disc list-inside">
            {initialOpportunity.attachments.map((attachment, index) => (
              <li key={index}>
                <a 
                  href={attachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  {attachment.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {isConfidential && canViewConfidential && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">{t('confidentialInformation')}</h3>
          <p>{t('confidentialInformationDescription')}</p>
          {/* Add confidential information here */}
        </div>
      )}
    </div>
  )
}

/**
 * opportunity-details component
 * Wraps the OpportunityDetailsContent with SessionProvider
 * 
 * @param {OpportunityDetailsProps} props - The component props
 * @returns {React.ReactElement} The wrapped opportunity details component
 */
const OpportunityDetails: React.FC<OpportunityDetailsProps> = (props) => {
  return (
    <SessionProvider>
      <OpportunityDetailsContent {...props} />
    </SessionProvider>
  )
}

export default OpportunityDetails

