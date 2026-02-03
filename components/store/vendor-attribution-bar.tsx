'use client'

/**
 * Vendor Attribution Bar Component
 * Displays vendor identity prominently on product cards
 * Part of GreenFood.live agricultural marketplace design
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tractor, Home, Store, ChefHat, Users, ShieldCheck, BadgeCheck, Star } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export interface VendorInfo {
  vendorId: string
  vendorName: string
  vendorType: 'farm' | 'food-producer' | 'farmers-market' | 'artisan' | 'cooperative'
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'trusted' | 'premium'
  avatar?: string
  responseTime?: number // hours
  fulfillmentRate?: number // percentage
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

const vendorTypeLabels = {
  farm: 'Organic Farm',
  'food-producer': 'Food Producer',
  'farmers-market': 'Farmers Market',
  artisan: 'Artisan Producer',
  cooperative: 'Cooperative',
}

const trustTierConfig = {
  PREMIUM: {
    icon: Star,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    label: 'Premium Vendor',
    description: '1+ years, 4.8+ rating, $50K+ sales',
  },
  TRUSTED: {
    icon: ShieldCheck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    label: 'Trusted Vendor',
    description: '6+ months, 4.7+ rating, $10K+ sales',
  },
  VERIFIED: {
    icon: BadgeCheck,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    label: 'Verified Vendor',
    description: '90+ days, 4.5+ rating, $1K+ sales',
  },
  BASIC: {
    icon: BadgeCheck,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    label: 'Basic Vendor',
    description: '30+ days active, positive feedback',
  },
  NEW: {
    icon: BadgeCheck,
    color: 'text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    label: 'New Vendor',
    description: 'Recently joined marketplace',
  },
}

export function VendorAttributionBar({ vendor, compact = false, className = '' }: VendorAttributionBarProps) {
  const VendorIcon = vendorTypeIcons[vendor.vendorType]
  const tierConfig = vendor.trustTier ? trustTierConfig[vendor.trustTier] : trustTierConfig.NEW
  const TrustIcon = tierConfig.icon

  const getVendorInitial = () => {
    return vendor.vendorName.charAt(0).toUpperCase()
  }

  return (
    <div
      className={`
        flex items-center gap-3 px-4 
        ${compact ? 'h-12 py-2' : 'h-14 py-3'}
        bg-emerald-50 dark:bg-emerald-950/30 
        border-t border-emerald-200 dark:border-emerald-800
        transition-colors duration-200
        hover:bg-emerald-100 dark:hover:bg-emerald-900/40
        ${className}
      `}
    >
      {/* Vendor Avatar */}
      <Link href={`/store/vendors/${vendor.vendorId}`} className="group">
        <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} border-2 border-emerald-400 dark:border-emerald-600 transition-transform group-hover:scale-110 rounded-full overflow-hidden relative`}>
          {vendor.avatar ? (
            <Image 
              src={vendor.avatar} 
              alt={vendor.vendorName} 
              fill
              className="object-cover" 
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold text-sm flex items-center justify-center">
              {getVendorInitial()}
            </div>
          )}
        </div>
      </Link>

      {/* Vendor Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/store/vendors/${vendor.vendorId}`} className="group">
          <h4 className={`
            ${compact ? 'text-xs' : 'text-sm'} 
            font-semibold 
            text-gray-900 dark:text-gray-100 
            truncate
            group-hover:text-emerald-600 dark:group-hover:text-emerald-400
            group-hover:underline
            transition-colors
          `}>
            {vendor.vendorName}
          </h4>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          <VendorIcon className="w-3 h-3" />
          <span>{vendorTypeLabels[vendor.vendorType]}</span>
          {vendor.responseTime && vendor.responseTime < 24 && (
            <>
              <span className="text-gray-400">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Fast response
              </span>
            </>
          )}
        </div>
      </div>

      {/* Trust Badge */}
      {vendor.trustTier && vendor.trustTier !== 'NEW' && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`
                flex items-center justify-center
                ${compact ? 'w-7 h-7' : 'w-8 h-8'}
                rounded-full
                ${tierConfig.bgColor}
                transition-transform hover:scale-110
                cursor-help
              `}>
                <TrustIcon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${tierConfig.color}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                <p className="font-semibold">{tierConfig.label}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{tierConfig.description}</p>
                {vendor.fulfillmentRate && (
                  <p className="text-xs">
                    <span className="font-medium">{vendor.fulfillmentRate}%</span> order fulfillment rate
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

/**
 * Compact variant for grid views
 */
export function VendorAttributionBarCompact(props: VendorAttributionBarProps) {
  return <VendorAttributionBar {...props} compact={true} />
}

/**
 * Vendor Badge (standalone, for use in other contexts)
 */
export function VendorBadge({ vendor }: { vendor: VendorInfo }) {
  const VendorIcon = vendorTypeIcons[vendor.vendorType]
  
  return (
    <Link href={`/store/vendors/${vendor.vendorId}`}>
      <Badge variant="outline" className="flex items-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer">
        <div className="w-4 h-4 rounded-full overflow-hidden relative">
          {vendor.avatar ? (
            <Image 
              src={vendor.avatar} 
              alt={vendor.vendorName} 
              fill
              className="object-cover" 
              sizes="16px"
            />
          ) : (
            <div className="w-full h-full bg-emerald-600 text-white text-xs flex items-center justify-center">
              {vendor.vendorName.charAt(0)}
            </div>
          )}
        </div>
        <VendorIcon className="w-3 h-3" />
        <span className="text-xs font-medium">{vendor.vendorName}</span>
      </Badge>
    </Link>
  )
}

