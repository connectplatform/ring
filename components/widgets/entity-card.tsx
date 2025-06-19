'use client'

import React, { memo, useEffect } from 'react'
import Image from 'next/image'
import { Entity } from '@/types'
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'

// React 19 Resource Preloading APIs
import { preload } from 'react-dom'

interface EntityCardProps {
  entity: Entity
}

const EntityCard: React.FC<EntityCardProps> = memo(({ entity }) => {
  // React 19 Resource Preloading - Entity-specific Performance Optimization
  useEffect(() => {
    // Preload entity logo if it exists and is not a placeholder
    if (entity.logo && entity.logo !== '/placeholder.svg') {
      preload(entity.logo, { as: 'image' })
    }
    
    // Preload common entity-related assets
    preload('/icons/building-outline.svg', { as: 'image' })
    preload('/icons/location-pin.svg', { as: 'image' })
    
    // Preload entity detail page resources for faster navigation
    preload(`/api/entities/${entity.id}`, { as: 'fetch' })
    
    // Preload entity-specific images if they follow a pattern
    if (entity.id) {
      preload(`/images/entities/${entity.id}/banner.webp`, { as: 'image' })
      preload(`/images/entities/${entity.id}/gallery-thumb.webp`, { as: 'image' })
    }
  }, [entity.id, entity.logo])

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Image
            src={entity.logo || '/placeholder.svg'}
            alt={`${entity.name} logo`}
            width={100}
            height={100}
            className="rounded-full"
            loading="lazy"
            priority={false}
          />
          <CardTitle className="text-xl font-bold">{entity.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-gray-600 dark:text-gray-300">
          {entity.shortDescription}
        </CardDescription>
      </CardContent>
    </Card>
  )
})

EntityCard.displayName = 'EntityCard'

export default EntityCard