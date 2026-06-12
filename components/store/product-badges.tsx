'use client'

/**
 * Agricultural Certification & Sustainability Badges
 * GreenFood.live visual identity components
 */

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Leaf, Sprout, CloudOff, Shield, Link as LinkIcon, Award, Heart, Tractor,
  Zap, Droplet, Sun, BadgeCheck, Star
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BadgeProps {
  className?: string
  showTooltip?: boolean
}

/**
 * Organic Certification Badge
 */
export function OrganicBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400 flex items-center gap-1', className)}>
      <Leaf className="w-3 h-3" />
      <span className="font-semibold">Organic</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">USDA Organic Certified</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Produced without synthetic pesticides or fertilizers</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Regenerative Agriculture Badge
 */
export function RegenerativeBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center gap-1', className)}>
      <Sprout className="w-3 h-3" />
      <span className="font-semibold">Regenerative</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Regenerative Agriculture</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Practices that restore soil health and biodiversity</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">+10% DAAR Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Carbon Negative Badge
 */
export function CarbonNegativeBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center gap-1', className)}>
      <CloudOff className="w-3 h-3" />
      <span className="font-semibold">Carbon Negative</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Carbon Negative Production</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Removes more CO2 than it produces</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">+15% DAAR Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * FSMA 204 Compliance Badge
 */
export function FSMAComplianceBadge({ traceabilityScore, className, showTooltip = true }: BadgeProps & { traceabilityScore?: number }) {
  const badge = (
    <Badge className={cn('bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 flex items-center gap-1', className)}>
      <Shield className="w-3 h-3" />
      <span className="font-semibold">
        FSMA 204{traceabilityScore && ` (${traceabilityScore}%)`}
      </span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">FSMA 204 Compliant</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">FDA Food Traceability Rule compliant</p>
          {traceabilityScore && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
              Traceability Score: {traceabilityScore}%
            </p>
          )}
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">+75 DAARION Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Blockchain Traceability Badge
 */
export function BlockchainBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 flex items-center gap-1', className)}>
      <LinkIcon className="w-3 h-3" />
      <span className="font-semibold">Blockchain</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Blockchain Verified</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Full supply chain recorded on blockchain</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">+100 DAARION Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Fair Trade Badge
 */
export function FairTradeBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-1', className)}>
      <Heart className="w-3 h-3" />
      <span className="font-semibold">Fair Trade</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Fair Trade Certified</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Ethical labor practices and fair prices</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">+5% DAAR Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Local (<100km) Badge
 */
export function LocalBadge({ distance, className, showTooltip = true }: BadgeProps & { distance?: number }) {
  const badge = (
    <Badge className={cn('bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 flex items-center gap-1', className)}>
      <Tractor className="w-3 h-3" />
      <span className="font-semibold">
        Local{distance && ` (${distance.toFixed(1)}km)`}
      </span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Locally Grown</p>
          {distance && (
            <p className="text-xs text-gray-600 dark:text-gray-400">{distance.toFixed(1)} km from you</p>
          )}
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">+3% DAAR Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Renewable Energy Badge
 */
export function RenewableEnergyBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 flex items-center gap-1', className)}>
      <Sun className="w-3 h-3" />
      <span className="font-semibold">Renewable</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Renewable Energy Powered</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Produced using 100% renewable energy</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">+4% DAAR Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Water Conservation Badge
 */
export function WaterConservationBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400 flex items-center gap-1', className)}>
      <Droplet className="w-3 h-3" />
      <span className="font-semibold">Water Smart</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Water Conservation</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Efficient irrigation and water management</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Non-GMO Badge
 */
export function NonGMOBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400 flex items-center gap-1', className)}>
      <BadgeCheck className="w-3 h-3" />
      <span className="font-semibold">Non-GMO</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Non-GMO Verified</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Free from genetically modified organisms</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Animal Welfare Badge
 */
export function AnimalWelfareBadge({ className, showTooltip = true }: BadgeProps) {
  const badge = (
    <Badge className={cn('bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400 flex items-center gap-1', className)}>
      <Heart className="w-3 h-3" />
      <span className="font-semibold">Animal Welfare</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Animal Welfare Certified</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Humane treatment and living conditions</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">+3% DAAR Bonus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Premium Quality Badge
 */
export function PremiumQualityBadge({ grade, className, showTooltip = true }: BadgeProps & { grade?: string }) {
  const badge = (
    <Badge className={cn('bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 flex items-center gap-1', className)}>
      <Star className="w-3 h-3 fill-yellow-600" />
      <span className="font-semibold">Grade {grade || 'A'}</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Premium Quality</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Grade {grade || 'A'} certified quality</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * DAAR Rewards Indicator
 */
export function DaarRewardsBadge({ bonus, reason, className }: { bonus: number; reason?: string; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center gap-1', className)}>
            <Zap className="w-3 h-3 fill-emerald-600" />
            <span className="font-bold">+{bonus}% DAAR</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">DAAR Token Rewards</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Earn {bonus}% bonus DAAR tokens{reason && `: ${reason}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

