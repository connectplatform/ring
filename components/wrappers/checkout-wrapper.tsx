'use client'

/**
 * CHECKOUT PAGE WRAPPER - Ring Platform v2.0
 * ==========================================
 * Standardized 3-column responsive layout for checkout pages
 *
 * Layout Structure:
 * - Desktop: DesktopSidebar (280px) + Center Content + Right Sidebar (320px)
 * - iPad: DesktopSidebar (280px) + Center Content + Floating Toggle for Right Sidebar
 * - Mobile: Center Content + Bottom Navigation + Floating Toggle for Right Sidebar
 *
 * Right Sidebar Content:
 * - Order Summary
 * - Payment Security
 * - Delivery Options
 * - Help & Support
 *
 * Strike Team:
 * - Ring Components Specialist (layout pattern)
 * - React 19 Specialist (modern patterns)
 * - E-commerce Expert (checkout UX)
 * - Security Specialist (payment protection)
 * - UI/UX Optimization Agent (mobile excellence)
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { Locale } from '@/i18n-config'
import DesktopSidebar from '@/components/navigation/desktop-sidebar'
import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CreditCard,
  Shield,
  Truck,
  HelpCircle,
  Lock,
  CheckCircle,
  Clock,
  Phone,
  MessageCircle,
  BookOpen,
  Award,
  Globe
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'

interface CheckoutWrapperProps {
  children: React.ReactNode
  locale: string
}

export default function CheckoutWrapper({
  children,
  locale
}: CheckoutWrapperProps) {
  const router = useRouter()
  const t = useTranslations('modules.store.checkout')
  const tCommon = useTranslations('common')
  const [mounted, setMounted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Mock order summary (will be dynamic later)
  const orderSummary = {
    items: [
      { name: 'Organic Green Tea', quantity: 2, price: 30.00 },
      { name: 'Fresh Basil', quantity: 1, price: 8.50 },
      { name: 'Artisan Honey', quantity: 1, price: 22.00 },
    ],
    subtotal: 60.50,
    shipping: 0,
    tax: 4.84,
    total: 65.34
  }

  // Payment security features
  const securityFeatures = [
    {
      id: 'ssl',
      title: t('sslEncryption', { defaultValue: 'SSL Encryption' }),
      description: t('sslDescription', { defaultValue: '256-bit SSL encryption protects your data' }),
      icon: Lock
    },
    {
      id: 'pci',
      title: t('pciCompliant', { defaultValue: 'PCI Compliant' }),
      description: t('pciDescription', { defaultValue: 'Certified PCI DSS Level 1 security' }),
      icon: Shield
    },
    {
      id: 'token',
      title: t('tokenization', { defaultValue: 'Tokenization' }),
      description: t('tokenDescription', { defaultValue: 'Your card details are never stored' }),
      icon: CreditCard
    },
    {
      id: 'monitoring',
      title: t('fraudMonitoring', { defaultValue: 'Fraud Monitoring' }),
      description: t('fraudDescription', { defaultValue: '24/7 fraud detection and prevention' }),
      icon: Award
    },
  ]

  // Delivery options
  const deliveryOptions = [
    {
      id: 'standard',
      name: t('standardDelivery', { defaultValue: 'Standard Delivery' }),
      cost: t('free', { defaultValue: 'Free' }),
      time: '3-5 business days',
      selected: true
    },
    {
      id: 'express',
      name: t('expressDelivery', { defaultValue: 'Express Delivery' }),
      cost: '$9.99',
      time: '1-2 business days',
      selected: false
    },
    {
      id: 'overnight',
      name: t('overnightDelivery', { defaultValue: 'Overnight Delivery' }),
      cost: '$19.99',
      time: 'Next business day',
      selected: false
    },
  ]

  // Help & support options
  const supportOptions = [
    {
      id: 'phone',
      title: t('phoneSupport', { defaultValue: 'Phone Support' }),
      description: '1-800-RING-HELP',
      available: '24/7',
      icon: Phone
    },
    {
      id: 'chat',
      title: t('liveChat', { defaultValue: 'Live Chat' }),
      description: t('chatDescription', { defaultValue: 'Instant help from our experts' }),
      available: '24/7',
      icon: MessageCircle
    },
    {
      id: 'faq',
      title: t('faq', { defaultValue: 'FAQ' }),
      description: t('faqDescription', { defaultValue: 'Find answers to common questions' }),
      available: 'Always',
      icon: HelpCircle
    },
    {
      id: 'guide',
      title: t('checkoutGuide', { defaultValue: 'Checkout Guide' }),
      description: t('guideDescription', { defaultValue: 'Step-by-step checkout instructions' }),
      available: 'Always',
      icon: BookOpen
    },
  ]

  const RightSidebarContent = () => (
    <div className="space-y-6">
      {/* Order Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('orderSummary', { defaultValue: 'Order Summary' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Order Items */}
          <div className="space-y-2">
            {orderSummary.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="flex-1">{item.name} × {item.quantity}</span>
                <span>${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Order Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('subtotal', { defaultValue: 'Subtotal' })}</span>
              <span>${orderSummary.subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span>{t('shipping', { defaultValue: 'Shipping' })}</span>
              <span className="text-green-600">
                {orderSummary.shipping === 0 ? t('free', { defaultValue: 'Free' }) : `$${orderSummary.shipping.toFixed(2)}`}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>{t('tax', { defaultValue: 'Tax' })}</span>
              <span>${orderSummary.tax.toFixed(2)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between font-medium">
            <span>{t('total', { defaultValue: 'Total' })}</span>
            <span>${orderSummary.total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('paymentSecurity', { defaultValue: 'Payment Security' })}
          </CardTitle>
          <CardDescription>
            {t('securityDescription', { defaultValue: 'Your payment information is fully protected' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityFeatures.map((feature) => (
            <div key={feature.id} className="flex items-start gap-3">
              <div className="p-1 bg-green-100 rounded">
                <feature.icon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                {t('secureCheckout', { defaultValue: 'Secure Checkout Guaranteed' })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Options Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            {t('deliveryOptions', { defaultValue: 'Delivery Options' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deliveryOptions.map((option) => (
            <div
              key={option.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                option.selected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{option.name}</p>
                  <p className="text-xs text-muted-foreground">{option.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{option.cost}</p>
                  {option.selected && (
                    <Badge variant="default" className="text-xs">
                      {t('selected', { defaultValue: 'Selected' })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="link"
            className="w-full p-0 h-auto"
            onClick={() => router.push(`/${locale}/docs/shipping`)}
          >
            {t('shippingPolicy', { defaultValue: 'Shipping Policy' })} →
          </Button>
        </CardContent>
      </Card>

      {/* Help & Support Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            {t('helpSupport', { defaultValue: 'Help & Support' })}
          </CardTitle>
          <CardDescription>
            {t('supportDescription', { defaultValue: 'Get help with your order anytime' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportOptions.map((option) => (
            <div key={option.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
              <div className="p-2 bg-primary/10 rounded-lg">
                <option.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                <p className="text-xs text-primary">{option.available}</p>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/${locale}/support`)}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {t('contactSupport', { defaultValue: 'Contact Support' })}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground relative transition-colors duration-300">
      <div className="flex gap-6 min-h-screen">
        {/* Left Sidebar - Main Navigation (Desktop only) */}
        <div className="hidden md:block w-[280px] flex-shrink-0">
          <DesktopSidebar />
        </div>

        {/* Center Content Area - Full width of middle column */}
        <div className="flex-1 min-w-0 py-8 px-4 md:px-6 lg:px-8 lg:pb-8 pb-24">
          {children}
        </div>

        {/* Right Sidebar - Disabled for checkout as PrebillingPage has own sidebar */}
        {/* The PrebillingPage component handles order summary with real cart data */}
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
