'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/node_modules/react-i18next'
import { useTheme } from 'next-themes'
import { Entity } from '@/types'
import Link from 'next/link'
import { Building2, MapPin, Tag, Globe, Calendar, Users, Award } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const [entities, setentities] = useState<Entity[]>(initialEntities)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [lastVisible, setLastVisible] = useState<string | null>(initialLastVisible)

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
        <motion.h1
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-4xl font-bold text-center mb-8">{t('entitiesTitle')}</div>
        </motion.h1>
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

