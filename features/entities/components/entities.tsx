'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'
import { Entity } from '@/types'
import Link from 'next/link'
import { Building2, MapPin, Tag, Globe, Calendar, Users, Award, Plus, ArrowUp } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserRole } from '@/features/auth/types'
import { ROUTES } from '@/constants/routes'
import { defaultLocale } from '@/utils/i18n-server'
import SlidingPopup from '@/components/widgets/modal'
import UpgradeRequestModal from '@/components/modals/upgrade-request-modal'

interface EntitiesContentProps {
  initialEntities: Entity[];
  initialError: string | null;
  page: number;
  totalPages: number;
  totalEntities: number;
  lastVisible: string | null;
  limit: number;
  sort: string;
  filter: string;
}

export const EntitiesContent: React.FC<EntitiesContentProps> = ({ 
  initialEntities, 
  initialError, 
  page, 
  totalPages, 
  totalEntities, 
  lastVisible: initialLastVisible,
  limit,
  sort,
  filter
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { data: session } = useSession()
  const [entities, setentities] = useState<Entity[]>(initialEntities)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [lastVisible, setLastVisible] = useState<string | null>(initialLastVisible)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const fetchEntities = useCallback(async () => {
    if (initialError || initialEntities.length > 0) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/entities?page=${page}&limit=${limit}&sort=${sort}&filter=${filter}`)
      if (!response.ok) {
        throw new Error('Failed to fetch entities')
      }
      const fetchedEntities = await response.json()
      setentities(fetchedEntities)
    } catch (error) {
      console.error('Error fetching entities:', error)
      setError(t('errorFetchingentities'))
    } finally {
      setLoading(false)
    }
  }, [initialEntities, initialError, t, page, lastVisible, limit, sort, filter])

  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  // Check if user can create entities (MEMBER and above)
  const canCreateEntity = session?.user?.role && [
    UserRole.MEMBER, 
    UserRole.CONFIDENTIAL, 
    UserRole.ADMIN
  ].includes(session.user.role as UserRole)

  // Check if user needs upgrade (VISITOR or SUBSCRIBER)
  const needsUpgrade = !session?.user || [
    UserRole.VISITOR, 
    UserRole.SUBSCRIBER
  ].includes(session?.user?.role as UserRole)

  const handleUpgradeRequest = async (requestData: any) => {
    try {
      // Here you would typically call an API to submit the upgrade request
      console.log('Submitting upgrade request:', requestData)
      
      // For now, show success message
      // In a real implementation, you'd call the upgrade request API
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      
    } catch (error) {
      console.error('Error submitting upgrade request:', error)
      throw error
    }
  }

  const handleCloseUpgradeModal = async () => {
    setShowUpgradeModal(false)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-xl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {t('loadingMessage')}
        </motion.p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-6">{t('entitiesTitle')}</h1>
          
          {/* Action Buttons Section */}
          <div className="flex justify-center gap-4 mb-8">
            {canCreateEntity ? (
              <Button asChild size="lg" className="gap-2">
                <Link href={ROUTES.ADD_ENTITY(defaultLocale)}>
                  <Plus className="h-5 w-5" />
                  {t('addMyEntity') || 'Add my Entity'}
                </Link>
              </Button>
            ) : needsUpgrade ? (
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2"
                onClick={() => setShowUpgradeModal(true)}
              >
                <ArrowUp className="h-5 w-5" />
                {t('upgradeToBeMember') || 'Upgrade to Member'}
              </Button>
            ) : null}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
        
        <Pagination 
          page={page} 
          totalPages={totalPages} 
          totalEntities={totalEntities}
        />
      </div>

      {/* Upgrade Modal for Visitors/Subscribers */}
      {needsUpgrade && session?.user && (
        <SlidingPopup
          isOpen={showUpgradeModal}
          onCloseAction={handleCloseUpgradeModal}
        >
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {t('upgradeToBeMember') || 'Upgrade to Member'}
            </h2>
            <div className="space-y-4 text-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">
                  {t('memberBenefits') || 'Member Benefits'}
                </h3>
                <ul className="text-sm space-y-2 text-left">
                  <li className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    {t('createEntities') || 'Create and manage entities'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    {t('postOpportunities') || 'Post business opportunities'}
                  </li>
                  <li className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-500" />
                    {t('accessMemberContent') || 'Access member-only content'}
                  </li>
                </ul>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {t('upgradeDescription') || 'To add entities and access full platform features, upgrade your account to Member status.'}
              </div>
              
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  {t('cancel') || 'Cancel'}
                </Button>
                <Button
                  onClick={() => {
                    setShowUpgradeModal(false)
                    // Redirect to contact or upgrade page
                    window.open('mailto:support@ring.ck.ua?subject=Member%20Upgrade%20Request', '_blank')
                  }}
                >
                  {t('requestUpgrade') || 'Request Upgrade'}
                </Button>
              </div>
            </div>
          </div>
        </SlidingPopup>
      )}
    </div>
  )
}

const EntityCard: React.FC<{ entity: Entity }> = ({ entity }) => {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">{entity.name}</h2>
            {entity.logo && (
              <img src={entity.logo} alt={`${entity.name} logo`} className="w-12 h-12 object-contain" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">{entity.shortDescription}</p>
          <EntityDetails entity={entity} />
        </CardContent>
        <CardFooter className="bg-muted/50">
          <Link href={`/entities/${entity.id}`} passHref className="w-full">
            <Button className="w-full">{t('viewDetails')}</Button>
          </Link>
        </CardFooter>
        {entity.visibility === 'member' && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
            {t('membersOnly')}
          </div>
        )}
      </Card>
    </motion.div>
  )
}

const EntityDetails: React.FC<{ entity: Entity }> = ({ entity }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="space-y-2">
        <DetailItem icon={Building2} text={entity.type} />
        <DetailItem icon={MapPin} text={entity.location} />
        {entity.website && (
          <DetailItem 
            icon={Globe} 
            text={t('visitWebsite')} 
            link={entity.website} 
          />
        )}
        {entity.foundedYear && (
          <DetailItem 
            icon={Calendar} 
            text={t('foundedIn', { year: entity.foundedYear })} 
          />
        )}
        {entity.employeeCount && (
          <DetailItem 
            icon={Users} 
            text={t('employees', { count: entity.employeeCount })} 
          />
        )}
      </div>
      <TagList title={t('tags')} items={entity.tags} icon={Tag} className="mt-4" />
      <TagList title={t('certifications')} items={entity.certifications} icon={Award} className="mt-4" />
    </>
  )
}

const DetailItem: React.FC<{ 
  icon: React.ElementType, 
  text: string, 
  link?: string 
}> = ({ icon: Icon, text, link }) => (
  <div className="flex items-center text-sm">
    <Icon className="w-4 h-4 mr-2" />
    {link ? (
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        {text}
      </a>
    ) : (
      <span>{text}</span>
    )}
  </div>
)

const TagList: React.FC<{ 
  title: string, 
  items?: string[], 
  icon: React.ElementType,
  className?: string
}> = ({ title, items, icon: Icon, className }) => {
  if (!items || items.length === 0) return null

  return (
    <div className={className}>
      <div className="flex items-center text-sm mb-2">
        <Icon className="w-4 h-4 mr-2" />
        <span className="font-semibold">{title}:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

const Pagination: React.FC<{
  page: number;
  totalPages: number;
  totalEntities: number;
}> = ({ page, totalPages, totalEntities }) => {
  const { t } = useTranslation()

  return (
    <div className="mt-8 flex justify-between items-center">
      <p className="text-sm text-muted-foreground">
        {t('showingentities', { start: (page - 1) * 10 + 1, end: Math.min(page * 10, totalEntities), total: totalEntities })}
      </p>
      <div className="flex space-x-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => {/* Implement previous page logic */}}
        >
          {t('previous')}
        </Button>
        <Button
          variant="outline"
          disabled={page === totalPages}
          onClick={() => {/* Implement next page logic */}}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  )
}

export default EntitiesContent

