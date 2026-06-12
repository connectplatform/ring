'use client'

/**
 * Vendor attribution on product cards (Ring Marketplace).
 */

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tractor, Home, Store, ChefHat, Users, ShieldCheck, BadgeCheck, Star } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export interface VendorInfo {
  vendorId: string
  vendorName: string
  /** Legacy agri IDs kept for stored data; labels come from locale. */
  vendorType: 'farm' | 'food-producer' | 'farmers-market' | 'artisan' | 'cooperative'
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'trusted' | 'premium'
  avatar?: string
  responseTime?: number
  fulfillmentRate?: number
  trustTier?: 'NEW' | 'BASIC' | 'VERIFIED' | 'TRUSTED' | 'PREMIUM'
}

interface VendorAttributionBarProps {
  vendor: VendorInfo
  compact?: boolean
  className?: string
}

const vendorTypeIcons = {
  farm: Tractor,
  'food-producer': Home,
  'farmers-market': Store,
  artisan: ChefHat,
  cooperative: Users,
}

export function VendorAttributionBar({ vendor, compact = false, className = '' }: VendorAttributionBarProps) {
  const t = useTranslations('modules.store.vendorAttribution')
  const VendorIcon = vendorTypeIcons[vendor.vendorType]
  const tierKey = vendor.trustTier && vendor.trustTier !== 'NEW' ? vendor.trustTier : null
  const TrustIcon =
    tierKey === 'PREMIUM'
      ? Star
      : tierKey === 'TRUSTED'
        ? ShieldCheck
        : BadgeCheck

  const getVendorInitial = () => vendor.vendorName.charAt(0).toUpperCase()

  return (
    <div
      className={`
        flex items-center gap-3 px-4 
        ${compact ? 'h-12 py-2' : 'h-14 py-3'}
        bg-muted/50
        border-t border-border
        transition-colors duration-200
        hover:bg-muted/80
        ${className}
      `}
    >
      <Link href={`/store/vendors/${vendor.vendorId}`} className="group">
        <div
          className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} border-2 border-primary/30 transition-transform group-hover:scale-110 rounded-full overflow-hidden relative`}
        >
          {vendor.avatar ? (
            <Image
              src={vendor.avatar}
              alt={vendor.vendorName}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-sm flex items-center justify-center">
              {getVendorInitial()}
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/store/vendors/${vendor.vendorId}`} className="group">
          <h4
            className={`
            ${compact ? 'text-xs' : 'text-sm'} 
            font-semibold 
            text-foreground
            truncate
            group-hover:text-primary
            group-hover:underline
            transition-colors
          `}
          >
            {vendor.vendorName}
          </h4>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <VendorIcon className="w-3 h-3" />
          <span>{t(`vendorTypes.${vendor.vendorType}`)}</span>
          {vendor.responseTime && vendor.responseTime < 24 && (
            <>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-primary font-medium">{t('fastResponse')}</span>
            </>
          )}
        </div>
      </div>

      {tierKey && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`
                flex items-center justify-center
                ${compact ? 'w-7 h-7' : 'w-8 h-8'}
                rounded-full
                bg-primary/10
                transition-transform hover:scale-110
                cursor-help
              `}
              >
                <TrustIcon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">{t(`trustTiers.${tierKey}.label`)}</p>
                <p className="text-xs text-muted-foreground">{t(`trustTiers.${tierKey}.description`)}</p>
                {vendor.fulfillmentRate != null && (
                  <p className="text-xs">
                    {t('fulfillmentRate', { rate: vendor.fulfillmentRate })}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

export function VendorAttributionBarCompact(props: VendorAttributionBarProps) {
  return <VendorAttributionBar {...props} compact />
}

export function VendorBadge({ vendor }: { vendor: VendorInfo }) {
  const t = useTranslations('modules.store.vendorAttribution')
  const VendorIcon = vendorTypeIcons[vendor.vendorType]

  return (
    <Link href={`/store/vendors/${vendor.vendorId}`}>
      <Badge
        variant="outline"
        className="flex items-center gap-1.5 hover:bg-muted transition-colors cursor-pointer"
      >
        <div className="w-4 h-4 rounded-full overflow-hidden relative">
          {vendor.avatar ? (
            <Image src={vendor.avatar} alt={vendor.vendorName} fill className="object-cover" sizes="16px" />
          ) : (
            <div className="w-full h-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {vendor.vendorName.charAt(0)}
            </div>
          )}
        </div>
        <VendorIcon className="w-3 h-3" />
        <span className="text-xs font-medium">{vendor.vendorName}</span>
        <span className="sr-only">{t(`vendorTypes.${vendor.vendorType}`)}</span>
      </Badge>
    </Link>
  )
}
