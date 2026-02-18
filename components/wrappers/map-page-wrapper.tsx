'use client'

/**
 * Map Page Wrapper - Full-Width Layout Pattern
 * 
 * Reverse-propagated from: ring-pet-friendly (2026-02-17)
 * 
 * Full-width layout for map interface (NO sidebars - map takes full viewport)
 * Mobile-optimized with floating controls
 * 
 * Pattern: Alternative to 3-column layout - optimized for map-centric pages
 * 
 * Use Cases:
 * - Entity location maps (offices, branches, coworking spaces)
 * - Store location finders (multi-vendor marketplace maps)
 * - Event venue maps (meetups, conferences, workshops)
 * - Real estate listing maps (properties, rentals)
 * - Restaurant finders (dining, cafes, food delivery)
 * - Pet-friendly place maps (ring-pet-friendly original use case)
 * 
 * Layout:
 * - Fixed top navigation bar with logo + actions
 * - Full-height map container (100vh minus nav bar)
 * - Floating controls overlay (filters, search, etc.)
 * - Mobile-responsive with touch-optimized controls
 * 
 * @see components/wrappers/opportunities-page-wrapper.tsx for 3-column alternative
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface MapPageWrapperProps {
  children: React.ReactNode
  locale: string
  /**
   * Optional navigation actions for top bar
   * If not provided, uses default home link only
   */
  navActions?: React.ReactNode
  /**
   * Optional brand name override
   * If not provided, uses instance config or default
   */
  brandName?: string
}

export function MapPageWrapper({ 
  children, 
  locale, 
  navActions,
  brandName 
}: MapPageWrapperProps) {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const t = useTranslations('common')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Dynamic brand name (supports white-label customization)
  const displayBrand = brandName || process.env.NEXT_PUBLIC_BRAND_NAME || 'Ring Platform'

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* Top Navigation Bar - Fixed */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo / Home */}
          <Link href={`/${locale}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Home className="h-5 w-5" />
            <span className="font-semibold">{displayBrand}</span>
          </Link>

          {/* Right Actions (Customizable per implementation) */}
          {navActions || (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/${locale}`)}
              >
                {t('home')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Map Container - Full height minus top bar (57px) */}
      <div className="h-full pt-[57px]">
        {children}
      </div>
    </div>
  )
}

/**
 * USAGE EXAMPLES
 * 
 * Basic Usage (Generic):
 * ```tsx
 * import { MapPageWrapper } from '@/components/wrappers/map-page-wrapper'
 * 
 * export default function MapPage({ params }: { params: Promise<{ locale: string }> }) {
 *   const { locale } = await params
 *   return (
 *     <MapPageWrapper locale={locale}>
 *       <YourMapComponent />
 *     </MapPageWrapper>
 *   )
 * }
 * ```
 * 
 * With Custom Nav Actions:
 * ```tsx
 * <MapPageWrapper 
 *   locale={locale}
 *   navActions={
 *     <div className="flex gap-2">
 *       <Button onClick={() => router.push(`/${locale}/listings`)}>My Listings</Button>
 *       <Button onClick={() => router.push(`/${locale}/favorites`)}>Favorites</Button>
 *       <Button onClick={() => router.push(`/${locale}/login`)}>Sign In</Button>
 *     </div>
 *   }
 * >
 *   <EntityLocationMap />
 * </MapPageWrapper>
 * ```
 * 
 * With Custom Branding:
 * ```tsx
 * <MapPageWrapper 
 *   locale={locale}
 *   brandName="Pet Friendly Places"
 * >
 *   <PetFriendlyMap />
 * </MapPageWrapper>
 * ```
 */
