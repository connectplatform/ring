'use client'

import React, { memo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession, SessionProvider } from 'next-auth/react'
import { Opportunity, Entity } from '@/types'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Tag, FileText, Building, User, Briefcase, Handshake, Heart, Users, Share2, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { Timestamp, FieldValue } from 'firebase/firestore'

// React 19 Resource Preloading APIs
import { preload } from 'react-dom'

/**
 * Helper function to get icon and styling for opportunity types
 */
function getOpportunityTypeConfig(type: string) {
  const configs = {
    request: { icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    offer: { icon: Briefcase, color: 'text-green-500', bgColor: 'bg-green-50' },
    partnership: { icon: Handshake, color: 'text-purple-500', bgColor: 'bg-purple-50' },
    volunteer: { icon: Heart, color: 'text-red-500', bgColor: 'bg-red-50' },
    mentorship: { icon: Users, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    resource: { icon: Share2, color: 'text-orange-500', bgColor: 'bg-orange-50' },
    event: { icon: CalendarDays, color: 'text-teal-500', bgColor: 'bg-teal-50' }
  }
  return configs[type as keyof typeof configs] || configs.request
}

/**
 * Props for the Opportunitycard component
 * @interface OpportunitycardProps
 * @property {Opportunity} opportunity - The opportunity data to display
 * @property {Entity | null} entity - The entity associated with the opportunity (null for private requests)
 * @property {any} creator - The creator/user info for private requests
 */
interface OpportunitycardProps {
  opportunity: Opportunity
  entity: Entity | null
  creator?: {
    id: string
    nickname?: string
    name?: string
    photoURL?: string
  }
}

/**
 * OpportunityCardContent component
 * Displays the content of an opportunity card
 * 
 * User steps:
 * 1. User views the opportunity card
 * 2. User can see opportunity details such as title, description, tags, deadline, location, type, and entity name
 * 3. User can click on "View Details" to see more information about the opportunity
 * 
 * @param {OpportunitycardProps} props - The component props
 * @returns {React.ReactElement} The rendered OpportunityCardContent
 */
const OpportunityCardContent: React.FC<OpportunitycardProps> = memo(({ opportunity, entity, creator }) => {
  const t = useTranslations('modules.opportunities')
  const { data: session } = useSession()

  // Get type configuration for styling and icons
  const typeConfig = getOpportunityTypeConfig(opportunity.type)

  // Determine display name and avatar for the card
  const isPrivateRequest = !entity && (opportunity.type === 'request' || opportunity.type === 'mentorship' || opportunity.type === 'resource')
  const displayName = isPrivateRequest 
    ? (creator?.nickname || creator?.name?.split(' ')[0] || 'Private User')
    : (entity?.name || 'Unknown Entity')
  const displayAvatar = isPrivateRequest
    ? (creator?.photoURL || '/placeholder-user.svg')
    : (entity?.logo || '/placeholder.svg')
  const displayIcon = isPrivateRequest ? User : Building

  // React 19 Resource Preloading - Opportunity-specific Performance Optimization
  useEffect(() => {
    // Preload avatar/logo if it exists and is not a placeholder
    if (displayAvatar && !displayAvatar.includes('placeholder')) {
      preload(displayAvatar, { as: 'image' })
    }
    
    
    // Preload opportunity detail page resources for faster navigation
    preload(`/api/opportunities/${opportunity.id}`, { as: 'fetch' })
    if (entity?.id) {
      preload(`/api/entities/${entity.id}`, { as: 'fetch' })
    }
    
    // Preload opportunity-specific images only if they exist (HEAD request check)
    if (opportunity.id) {
      const bannerUrl = `/images/opportunities/${opportunity.id}/banner.webp`
      const previewUrl = `/images/opportunities/${opportunity.id}/preview.webp`

      // Helper to check if image exists before preloading
      const checkAndPreload = (url: string) => {
        fetch(url, { method: 'HEAD' })
          .then(res => {
            if (res.ok) preload(url, { as: 'image' })
          })
          .catch(() => { /* Ignore missing images */ })
      }

      checkAndPreload(bannerUrl)
      checkAndPreload(previewUrl)
    }
    
    // Preload entity-specific images
    if (entity?.id) {
      preload(`/images/entities/${entity.id}/logo.webp`, { as: 'image' })
      preload(`/images/entities/${entity.id}/banner-small.webp`, { as: 'image' })
    }
  }, [opportunity.id, entity?.id, displayAvatar])

  /**
   * Formats a Timestamp or FieldValue to a localized date string
   * @param {Timestamp | FieldValue} timestamp - The timestamp to format
   * @returns {string} The formatted date string
   */
  const formatDate = (timestamp: Timestamp | FieldValue): string => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleDateString()
    } else {
      // Handle FieldValue case (e.g., serverTimestamp())
      // You might want to return a placeholder or fetch the actual value from the server
      return 'Date to be determined'
    }
  }

  return (
    <Card className="w-full hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar
              src={displayAvatar}
              alt={`${displayName} avatar`}
              fallback={displayName.charAt(0)}
            />
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {opportunity.title}
                {opportunity.priority === 'urgent' && (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                    {t('priorityUrgent', { defaultValue: 'Urgent' })}
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {isPrivateRequest && <User className="w-3 h-3" />}
                {displayName}
              </p>
            </div>
          </div>
          <div className={`p-2 rounded-full ${typeConfig.bgColor}`}>
            {React.createElement(typeConfig.icon, { 
              className: `w-5 h-5 ${typeConfig.color}` 
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">{opportunity.briefDescription}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {opportunity.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">{tag}</span>
          ))}
          {opportunity.tags.length > 3 && (
            <span className="text-xs text-muted-foreground" aria-label={`and ${opportunity.tags.length - 3} more tags`}>
              +{opportunity.tags.length - 3} more
            </span>
          )}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center">
            <dt className="sr-only">{t('deadline')}</dt>
            <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
            <dd>{t('deadline')}: {formatDate(opportunity.expirationDate)}</dd>
          </div>
          <div className="flex items-center">
            <dt className="sr-only">{t('location')}</dt>
            <MapPin className="w-4 h-4 mr-2" aria-hidden="true" />
            <dd>{t('location')}: {opportunity.location}</dd>
          </div>
          <div className="flex items-center">
            <dt className="sr-only">{t('type')}</dt>
            {React.createElement(typeConfig.icon, { className: `w-4 h-4 mr-2 ${typeConfig.color}`, 'aria-hidden': true })}
            <dd>{t('type')}: {t(opportunity.type, { defaultValue: opportunity.type })}</dd>
          </div>
          <div className="flex items-center">
            <dt className="sr-only">{isPrivateRequest ? t('creator') : t('entity.name')}</dt>
            {React.createElement(displayIcon, { className: "w-4 h-4 mr-2", 'aria-hidden': true })}
            <dd>{isPrivateRequest ? t('creator') : t('entity.name')}: {displayName}</dd>
          </div>
          {/* Show applicant count for opportunities that track applications */}
          {(opportunity.type === 'offer' || opportunity.type === 'volunteer' || opportunity.type === 'event') && opportunity.applicantCount !== undefined && (
            <div className="flex items-center">
              <dt className="sr-only">{t('applicants')}</dt>
              <Users className="w-4 h-4 mr-2" aria-hidden="true" />
              <dd>
                {t('applicants', { defaultValue: 'Applicants' })}: {opportunity.applicantCount}
                {opportunity.maxApplicants && ` / ${opportunity.maxApplicants}`}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter>
        <Link href={`/opportunities/${opportunity.id}`} passHref legacyBehavior>
          <Button component="a" variant="outline" className="w-full">
            {t('viewDetails')}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
})

OpportunityCardContent.displayName = 'OpportunityCardContent'

/**
 * Opportunitycard component
 * Wraps the OpportunityCardContent with a SessionProvider
 * 
 * @param {OpportunitycardProps} props - The component props
 * @returns {React.ReactElement} The rendered Opportunitycard
 */
const Opportunitycard: React.FC<OpportunitycardProps> = (props) => {
  return (
    <SessionProvider>
      <OpportunityCardContent {...props} />
    </SessionProvider>
  )
}

export default Opportunitycard

