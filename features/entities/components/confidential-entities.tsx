'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { useSession } from "next-auth/react"
import { Entity } from '@/types'
import Link from 'next/link'
import { Building2, MapPin, Tag, Globe, Calendar, Users, Award, Lock } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import LoginForm from '@/components/auth/login-form'

/**
 * Props for the ConfidentialEntitiesContent component
 * @interface ConfidentialEntitiesContentProps
 * @property {Entity[]} initialEntities - Initial list of confidential entities
 * @property {string | null} initialError - Initial error message, if any
 * @property {number} page - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} totalEntities - Total number of entities
 * @property {string | null} lastVisible - ID of the last visible entity for pagination
 * @property {number} limit - Number of entities to fetch per page
 * @property {string} sort - Sorting criteria for entities
 * @property {string} filter - Filter criteria for entities
 */
interface ConfidentialEntitiesContentProps {
  initialEntities: Entity[]
  initialError: string | null
  page: number
  totalPages: number
  totalEntities: number
  lastVisible: string | null
  limit: number
  sort: string
  filter: string
}

/**
 * ConfidentialEntitiesContent component
 * Displays a list of confidential entities with details
 * 
 * User steps:
 * 1. User navigates to the confidential entities page
 * 2. The component checks the user's session status
 * 3. If authenticated, it displays the list of confidential entities
 * 4. If not authenticated, it shows a login form
 * 5. User can view entity details and navigate to individual entity pages
 * 
 * @param {ConfidentialEntitiesContentProps} props - Component props
 * @returns {React.ReactElement} The rendered ConfidentialEntitiesContent component
 */
export const ConfidentialEntitiesContent: React.FC<ConfidentialEntitiesContentProps> = ({
  initialEntities,
  initialError,
  page,
  totalPages,
  totalEntities,
  lastVisible,
  limit,
  sort,
  filter
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { data: session, status } = useSession()
  const [entities, setEntities] = useState<Entity[]>(initialEntities)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  useEffect(() => {
    /**
     * Fetches confidential entities from the API
     */
    const fetchConfidentialEntities = async () => {
      if (initialError || initialEntities.length > 0) {
        return
      }

      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/confidential-entities?page=${page}&limit=${limit}&sort=${sort}&filter=${filter}${lastVisible ? `&startAfter=${lastVisible}` : ''}`)
        if (!response.ok) {
          throw new Error('Failed to fetch confidential entities')
        }
        const fetchedEntities = await response.json()
        setEntities(fetchedEntities)
      } catch (error) {
        console.error('Error fetching confidential entities:', error)
        setError(t('errorFetchingConfidentialEntities'))
      } finally {
        setLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchConfidentialEntities()
    }
  }, [initialEntities, initialError, t, status, page, limit, sort, filter, lastVisible])

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xl">{t('loadingMessage')}</div>
        </motion.p>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <LoginForm />
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xl">{t('loadingConfidentialMessage')}</div>
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
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-4xl font-bold text-center mb-8">{t('confidentialDirectoryTitle')}</div>
        </motion.h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entities.map((entity) => (
            <motion.div
              key={entity.id}
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
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Building2 className="w-4 h-4 mr-2" />
                      <span>{entity.type}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span>{entity.location}</span>
                    </div>
                    {entity.website && (
                      <div className="flex items-center text-sm">
                        <Globe className="w-4 h-4 mr-2" />
                        <a href={entity.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {t('visitWebsite')}
                        </a>
                      </div>
                    )}
                    {entity.foundedYear && (
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>{t('foundedIn', { year: entity.foundedYear })}</span>
                      </div>
                    )}
                    {entity.employeeCount && (
                      <div className="flex items-center text-sm">
                        <Users className="w-4 h-4 mr-2" />
                        <span>{t('employees', { count: entity.employeeCount })}</span>
                      </div>
                    )}
                  </div>
                  {entity.tags && entity.tags.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center text-sm mb-2">
                        <Tag className="w-4 h-4 mr-2" />
                        <span className="font-semibold">{t('tags')}:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {entity.tags.map((tag, index) => (
                          <span key={index} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {entity.certifications && entity.certifications.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center text-sm mb-2">
                        <Award className="w-4 h-4 mr-2" />
                        <span className="font-semibold">{t('certifications')}:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {entity.certifications.map((cert, index) => (
                          <span key={index} className="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded">{cert}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/50">
                  <Button asChild className="w-full">
                    <Link href={`/confidential/entities/${entity.id}`}>
                      {t('viewConfidentialDetails')}
                    </Link>
                  </Button>
                </CardFooter>
                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center">
                  <Lock className="w-3 h-3 mr-1" />
                  {t('confidential')}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ConfidentialEntitiesContent

