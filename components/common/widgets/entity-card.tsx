'use client'

import React, { memo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Entity, SerializedEntity } from '@/features/entities/types'
import { EntityTypeIcon, getEntityTypeConfig } from '@/components/entities/entity-type-icons'
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MapPin, 
  Users, 
  Calendar, 
  Globe, 
  Award, 
  MessageCircle, 
  Heart, 
  ExternalLink,
  CheckCircle,
  Building2,
  Phone,
  Mail
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/constants/routes'
import { Locale } from '@/i18n-config'

// React 19 Resource Preloading APIs
import { preload } from 'react-dom'

interface EntityCardProps {
  entity: Entity | SerializedEntity
  showQuickActions?: boolean
  compact?: boolean
  locale?: string
}

const EntityCard: React.FC<EntityCardProps> = memo(({ 
  entity, 
  showQuickActions = true, 
  compact = false,
  locale = 'en'
}) => {
  const t = useTranslations('modules.entities')
  const tCommon = useTranslations('common')
  
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

  const typeConfig = getEntityTypeConfig(entity.type)
  const isVerified = entity.certifications && entity.certifications.length > 0
  const hasPartnerships = entity.partnerships && entity.partnerships.length > 0
  
  // Format employee count
  const formatEmployeeCount = (count?: number) => {
    if (!count) return null
    if (count === 1) return '1 employee'
    if (count < 50) return `${count} employees`
    if (count < 200) return '50-200 employees'
    if (count < 500) return '200-500 employees'
    if (count < 1000) return '500-1000 employees'
    return '1000+ employees'
  }

  // Format founded year
  const formatFoundedYear = (year?: number) => {
    if (!year) return null
    const currentYear = new Date().getFullYear()
    const age = currentYear - year
    return `Founded ${year} (${age} years)`
  }

  // Format member since
  const formatMemberSince = (memberSince?: string | Date | any) => {
    if (!memberSince) return null
    
    let date: Date
    if (typeof memberSince === 'string') {
      date = new Date(memberSince)
    } else if (memberSince instanceof Date) {
      date = memberSince
    } else if (memberSince && typeof memberSince.toDate === 'function') {
      // Handle Firestore Timestamp
      date = memberSince.toDate()
    } else {
      date = new Date(memberSince)
    }
    
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 30) return `Member for ${diffDays} days`
    if (diffDays < 365) return `Member for ${Math.floor(diffDays / 30)} months`
    return `Member for ${Math.floor(diffDays / 365)} years`
  }

  const entityUrl = ROUTES.ENTITY(entity.id, locale as Locale)

  return (
    <Card className={cn(
      "group hover:shadow-lg transition-all duration-300 border-l-4",
      typeConfig.bgColor.replace('bg-', 'border-l-'),
      compact ? "h-auto" : "h-full"
    )}>
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="relative">
              <Image
                src={entity.logo || '/placeholder.svg'}
                alt={`${entity.name} logo`}
                width={compact ? 48 : 64}
                height={compact ? 48 : 64}
                className="rounded-lg object-cover"
                loading="lazy"
                priority={false}
              />
              {isVerified && (
                <div className="absolute -top-1 -right-1">
                  <CheckCircle className="w-5 h-5 text-green-500 bg-white rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <EntityTypeIcon 
                  type={entity.type} 
                  size="sm" 
                  variant="filled"
                />
                <CardTitle className={cn(
                  "font-semibold truncate",
                  compact ? "text-base" : "text-lg"
                )}>
                  {entity.name}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{typeConfig.label}</span>
                {entity.visibility !== 'public' && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    {entity.visibility}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-3", compact && "space-y-2")}>
        <CardDescription className={cn(
          "text-sm line-clamp-2",
          compact ? "text-xs" : "text-sm"
        )}>
          {entity.shortDescription}
        </CardDescription>

        {/* Key Information */}
        <div className="space-y-2">
          {entity.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{entity.location}</span>
            </div>
          )}
          
          {entity.employeeCount && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{formatEmployeeCount(entity.employeeCount)}</span>
            </div>
          )}
          
          {entity.foundedYear && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{formatFoundedYear(entity.foundedYear)}</span>
            </div>
          )}

          {entity.memberSince && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="w-3 h-3" />
              <span>{formatMemberSince(entity.memberSince)}</span>
            </div>
          )}
        </div>

        {/* Tags and Certifications */}
        <div className="flex flex-wrap gap-1">
          {isVerified && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 text-green-600 border-green-200">
              <Award className="w-3 h-3 mr-1" />
              Certified
            </Badge>
          )}
          
          {hasPartnerships && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 border-blue-200">
              <Globe className="w-3 h-3 mr-1" />
              Partnerships
            </Badge>
          )}
          
          {entity.services && entity.services.slice(0, 2).map((service, index) => (
            <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
              {service}
            </Badge>
          ))}
          
          {entity.services && entity.services.length > 2 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              +{entity.services.length - 2} more
            </Badge>
          )}
        </div>
      </CardContent>

      {showQuickActions && (
        <CardFooter className="pt-3 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {entity.contactEmail && (
                <Button size="sm" variant="ghost" className="h-8 px-2">
                  <Mail className="w-3 h-3" />
                </Button>
              )}
              
              {entity.phoneNumber && (
                <Button size="sm" variant="ghost" className="h-8 px-2">
                  <Phone className="w-3 h-3" />
                </Button>
              )}
              
              {entity.website && (
                <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
                  <a href={entity.website} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              )}
              
              <Button size="sm" variant="ghost" className="h-8 px-2">
                <MessageCircle className="w-3 h-3" />
              </Button>
              
              <Button size="sm" variant="ghost" className="h-8 px-2">
                <Heart className="w-3 h-3" />
              </Button>
            </div>
            
            <Button size="sm" variant="outline" asChild>
              <Link href={entityUrl}>
                {tCommon('viewProfile')}
              </Link>
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  )
})

EntityCard.displayName = 'EntityCard'

export default EntityCard