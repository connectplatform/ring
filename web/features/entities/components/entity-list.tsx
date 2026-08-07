'use client'

import React, { useState, useEffect } from 'react'
import { useOptimistic } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Building2, MapPin, Globe, Calendar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

// React 19 Resource Preloading APIs
import { preload, preinit } from 'react-dom'

// Client-side constant for default locale
const DEFAULT_LOCALE = 'en' as const

interface Entity {
  id: string
  name: string
  description: string
  category: string
  location?: string
  website?: string
  createdAt: Date
  createdBy: string
  pending?: boolean
}

interface EntityListProps {
  initialEntities: Entity[]
  onCreateEntityAction?: (entity: Omit<Entity, 'id' | 'createdAt'>) => void
  className?: string
}

export function EntityList({ initialEntities, onCreateEntityAction, className }: EntityListProps) {
  const t = useTranslations('modules.entities')
  const { data: session } = useSession()
  const [optimisticEntities, addOptimisticEntity] = useOptimistic(
    initialEntities,
    (state: Entity[], newEntity: Entity) => [...state, newEntity]
  )

  // React 19 Resource Preloading - Entity List Performance Optimization
  useEffect(() => {
    // Preload entity list related icons and assets
    preload('/icons/building2.svg', { as: 'image' })
    preload('/icons/map-pin.svg', { as: 'image' })
    preload('/icons/globe.svg', { as: 'image' })
    preload('/icons/calendar.svg', { as: 'image' })
    preload('/icons/plus.svg', { as: 'image' })
    
    // Preload entity placeholder and common assets
    preload('/images/entity-placeholder.svg', { as: 'image' })
    preload('/images/building-default.svg', { as: 'image' })
    
    // Preload entity list API endpoints
    preload('/api/entities', { as: 'fetch' })
    preload('/api/entities/categories', { as: 'fetch' })
    
    // Preload entity creation form resources
    if (session?.user) {
      preload('/api/entities/create', { as: 'fetch' })
      preload('/images/entity-form-background.webp', { as: 'image' })
    }
    
    // Preload entity detail page assets for faster navigation
    preload('/styles/entity-details.css', { as: 'style' })
    preload('/scripts/entity-interactions.js', { as: 'script' })
    
    // Preinit entity list analytics
    preinit('/scripts/entity-list-analytics.js', { as: 'script' })
    
    // Preload entity logos for visible entities - deduplicate IDs
    const uniqueEntityIds = [...new Set(optimisticEntities.slice(0, 10).map(e => e.id).filter(Boolean))]
    uniqueEntityIds.forEach(entityId => {
      preload(`/api/entities/${entityId}`, { as: 'fetch' })
      preload(`/images/entities/${entityId}/logo.webp`, { as: 'image' })
    })
  }, [session, optimisticEntities])

  const handleCreateEntity = async (entityData: Omit<Entity, 'id' | 'createdAt'>) => {
    if (!onCreateEntityAction) return

    const optimisticEntity: Entity = {
      ...entityData,
      id: `temp-${Date.now()}`,
      createdAt: new Date(),
      pending: true
    }

    addOptimisticEntity(optimisticEntity)
    
    try {
      await onCreateEntityAction(entityData)
    } catch (error) {
      console.error('Failed to create entity:', error)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('entities') || 'Entities'}</h2>
        {session?.user && (
          <Button asChild>
            <Link href={ROUTES.ADD_ENTITY(DEFAULT_LOCALE)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addMyEntity') || 'Add My Entity'}
            </Link>
          </Button>
        )}
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {optimisticEntities.map((entity) => (
            <motion.div
              key={entity.id}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.9 }}
              layout
            >
              <Card className={`h-full transition-all duration-200 hover:shadow-lg ${
                entity.pending ? 'opacity-70 border-dashed' : ''
              }`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {entity.pending ? (
                            <span>{entity.name}</span>
                          ) : (
                            <Link 
                              href={`${ROUTES.ENTITIES(DEFAULT_LOCALE)}/${entity.id}`}
                              className="hover:text-primary transition-colors"
                            >
                              {entity.name}
                            </Link>
                          )}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {entity.category}
                        </Badge>
                      </div>
                    </div>
                    
                    {entity.pending && (
                      <Badge variant="outline" className="text-xs">
                        {t('saving') || 'Saving...'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <CardDescription className="line-clamp-3">
                    {entity.description}
                  </CardDescription>

                  <div className="space-y-2">
                    {entity.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{entity.location}</span>
                      </div>
                    )}

                    {entity.website && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        <a 
                          href={entity.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors"
                        >
                          {t('website') || 'Website'}
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {entity.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {!entity.pending && (
                    <div className="pt-2">
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`${ROUTES.ENTITIES(DEFAULT_LOCALE)}/${entity.id}`}>
                          {t('viewDetails') || 'View Details'}
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {optimisticEntities.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('noEntities') || 'No entities found'}</h3>
          <p className="text-muted-foreground mb-4">
            {t('noEntitiesDescription') || 'Be the first to add an entity to the platform.'}
          </p>
          {session?.user && (
            <Button asChild>
              <Link href={ROUTES.ADD_ENTITY(DEFAULT_LOCALE)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('addFirstEntity') || 'Add First Entity'}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
} 