'use client'

/**
 * PRODUCT DETAILS PAGE WRAPPER - Ring Platform v2.0
 * ================================================
 * Standardized 3-column responsive layout for product detail pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Related Products
 * - Vendor Info
 * - Reviews Summary
 * - Share Product
 * - Shopping Guide
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - E-commerce Expert (product detail UX)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { SimilarProducts } from '@/features/store/components/similar-products'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Star,
  Share2,
  ShoppingBag,
  Store,
  BookOpen,
  Heart,
  MessageCircle,
  ThumbsUp,
  User,
  ExternalLink,
  Truck,
  Shield,
  Award
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface ProductDetailsWrapperProps {
  children: React.ReactNode
  locale: string
  productId?: string
  currentProduct?: any // StoreProduct
}

export default function ProductDetailsWrapper({
  children,
  locale,
  productId,
  currentProduct
}: ProductDetailsWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.store')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock related products (will be dynamic later)
  const relatedProducts = [
    { id: '1', name: 'Organic Green Tea', price: 15.99, rating: 4.8, image: '/placeholder.jpg' },
    { id: '2', name: 'Fresh Basil', price: 8.50, rating: 4.9, image: '/placeholder.jpg' },
    { id: '3', name: 'Artisan Honey', price: 22.00, rating: 4.7, image: '/placeholder.jpg' },
  ]

  // Mock vendor info (will be dynamic later)
  const vendorInfo = {
    name: 'GreenFood Collective',
    rating: 4.9,
    reviews: 1247,
    joined: '2023',
    location: 'Ukraine',
    verified: true
  }

  // Mock reviews summary (will be dynamic later)
  const reviewsSummary = {
    average: 4.6,
    total: 89,
    distribution: { 5: 67, 4: 15, 3: 4, 2: 2, 1: 1 }
  }

  const shareOptions = [
    { id: 'copy', label: t('copyLink', { defaultValue: 'Copy Link' }), icon: ExternalLink },
    { id: 'twitter', label: t('twitter', { defaultValue: 'Twitter' }), icon: MessageCircle },
    { id: 'facebook', label: t('facebook', { defaultValue: 'Facebook' }), icon: ThumbsUp },
  ]

  const shoppingGuide = [
    { id: 'shipping', title: t('freeShipping', { defaultValue: 'Free Shipping' }), icon: Truck, description: t('freeShippingDescription', { defaultValue: 'Orders over $50' }) },
    { id: 'secure', title: t('securePayment', { defaultValue: 'Secure Payment' }), icon: Shield, description: t('securePaymentDescription', { defaultValue: 'SSL encrypted' }) },
    { id: 'quality', title: t('qualityGuarantee', { defaultValue: 'Quality Guarantee' }), icon: Award, description: t('qualityGuaranteeDescription', { defaultValue: '100% satisfaction' }) },
  ]

  const handleShare = (optionId: string) => {
    // TODO: Implement sharing functionality
    console.log('Share via:', optionId)
    setRightSidebarOpen(false)
  }

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Similar Products - Vector Matching */}
      {currentProduct ? (
        <SimilarProducts
          currentProduct={currentProduct}
          locale={locale as any}
        />
      ) : (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t('relatedProducts', { defaultValue: 'Related Products' })}
          </CardTitle>
        </CardHeader>
          <CardContent className="text-sm text-muted-foreground text-center py-6">
            Loading similar products...
        </CardContent>
      </Card>
      )}

      {/* Vendor Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            {t('vendorInfo', { defaultValue: 'Vendor Info' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{vendorInfo.name}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{vendorInfo.rating}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  ({vendorInfo.reviews} reviews)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('memberSince', { defaultValue: 'Member since' })}</span>
              <span>{vendorInfo.joined}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('location', { defaultValue: 'Location' })}</span>
              <span>{vendorInfo.location}</span>
            </div>
            {vendorInfo.verified && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Award className="h-3 w-3 mr-1" />
                  {t('verified', { defaultValue: 'Verified' })}
                </Badge>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/${locale}/vendor/${vendorInfo.name.toLowerCase().replace(/\s+/g, '-')}`)}
          >
            {t('visitVendor', { defaultValue: 'Visit Vendor' })}
          </Button>
        </CardContent>
      </Card>

      {/* Reviews Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4" />
            {t('customerReviews', { defaultValue: 'Customer Reviews' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <span className="text-lg font-bold">{reviewsSummary.average}</span>
              <span className="text-muted-foreground">({reviewsSummary.total} reviews)</span>
            </div>
          </div>

          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((stars) => (
              <div key={stars} className="flex items-center gap-2 text-sm">
                <span className="w-3">{stars}</span>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-yellow-400 h-2 rounded-full"
                    style={{ width: `${(reviewsSummary.distribution[stars as keyof typeof reviewsSummary.distribution] / reviewsSummary.total) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-6 text-right">
                  {reviewsSummary.distribution[stars as keyof typeof reviewsSummary.distribution]}
                </span>
              </div>
            ))}
          </div>

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => {
              // TODO: Scroll to reviews section
              setRightSidebarOpen(false)
            }}
          >
            {t('readAllReviews', { defaultValue: 'Read All Reviews' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Share Product Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {t('shareProduct', { defaultValue: 'Share Product' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {shareOptions.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleShare(option.id)}
            >
              <option.icon className="h-4 w-4 mr-2" />
              {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Shopping Guide Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t('shoppingGuide', { defaultValue: 'Shopping Guide' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {shoppingGuide.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/shopping`)}
          >
            {t('learnMore', { defaultValue: 'Learn More' })} →
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      {/* Left Sidebar - Fixed positioned, outside flex layout */}
      <DesktopSidebar />

      <div className="flex gap-6 min-h-screen">
        {/* Center Content Area */}
        <div className="flex-1 py-8 px-4 md:px-6 lg:pr-6 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Product Info & Actions (Desktop only, 1024px+) */}
        <div className="hidden lg:block w-[320px] flex-shrink-0 py-8 pr-6">
          <div className="sticky top-8">
            <RightSidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Floating toggle sidebar for right sidebar content */}
      <FloatingSidebarToggle
        isOpen={rightSidebarOpen}
        onToggle={setRightSidebarOpen}
        mobileWidth="90%"
        tabletWidth="380px"
      >
        <RightSidebarContent />
      </FloatingSidebarToggle>
    </div>
  )
}
